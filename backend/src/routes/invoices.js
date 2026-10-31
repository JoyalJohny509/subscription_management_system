const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);

function padId(id, prefix) {
  return `${prefix}${String(id).padStart(4, '0')}`;
}

// ── GET /api/invoices ─────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status } = req.query;
  const role = req.user.role;

  let sql = `
    SELECT i.*, c.company_name, u.name AS customer_name
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'customer') {
    sql += ` AND c.user_id = ?`;
    params.push(req.user.id);
  }
  if (status) { sql += ` AND i.status = ?`; params.push(status); }
  sql += ` ORDER BY i.id DESC`;

  const rows = db.prepare(sql).all(...params);
  return res.json({ data: rows, total: rows.length });
});

// ── POST /api/invoices ────────────────────────────────────────────────────────
router.post('/', authorize('admin', 'staff'), (req, res) => {
  const { subscription_id, customer_id, issue_date, due_date, billing_period_start,
          billing_period_end, notes, lines } = req.body;

  if (!subscription_id || !customer_id) {
    return res.status(400).json({ error: 'subscription_id and customer_id are required' });
  }

  let subtotal = 0, tax_total = 0;
  if (Array.isArray(lines)) {
    for (const l of lines) {
      const base = (l.unit_price || 0) * (l.qty || 1);
      subtotal  += base;
      tax_total += base * ((l.tax_pct || 0) / 100);
    }
  }
  const grand_total = subtotal + tax_total;

  const result = db.prepare(`
    INSERT INTO invoices (subscription_id, customer_id, issue_date, due_date, billing_period_start,
                          billing_period_end, notes, subtotal, tax_total, grand_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(subscription_id, customer_id, issue_date || null, due_date || null,
         billing_period_start || null, billing_period_end || null, notes || null,
         subtotal, tax_total, grand_total);

  const invId = result.lastInsertRowid;
  const invoice_number = padId(invId, 'INV-');
  db.prepare(`UPDATE invoices SET invoice_number=? WHERE id=?`).run(invoice_number, invId);

  if (Array.isArray(lines)) {
    const stmt = db.prepare(`
      INSERT INTO invoice_lines (invoice_id, product_id, description, qty, unit_price, tax_pct, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of lines) {
      const base = (l.unit_price || 0) * (l.qty || 1);
      const tax  = base * ((l.tax_pct || 0) / 100);
      stmt.run(invId, l.product_id || null, l.description || null, l.qty || 1, l.unit_price || 0, l.tax_pct || 0, base + tax);
    }
  }

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
  return res.status(201).json({ data: invoice, message: 'Invoice created' });
});

// ── GET /api/invoices/:id ─────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, c.company_name, u.name AS customer_name, u.email AS customer_email
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  if (req.user.role === 'customer') {
    const cust = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(invoice.customer_id);
    if (!cust || cust.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  }

  const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ?').all(req.params.id);
  return res.json({ data: { ...invoice, lines } });
});

// ── POST /api/invoices/generate/:subscription_id ──────────────────────────────
router.post('/generate/:subscription_id', authorize('admin', 'staff'), (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND status = ?').get(req.params.subscription_id, 'active');
  if (!sub) return res.status(404).json({ error: 'Active subscription not found' });

  const { billing_period_start, billing_period_end, issue_date, due_date } = req.body;

  // Check duplicate billing period
  if (billing_period_start && billing_period_end) {
    const duplicate = db.prepare(`
      SELECT id FROM invoices
      WHERE subscription_id = ? AND billing_period_start = ? AND billing_period_end = ?
        AND status != 'cancelled'
    `).get(req.params.subscription_id, billing_period_start, billing_period_end);
    if (duplicate) return res.status(409).json({ error: 'Invoice for this billing period already exists' });
  }

  // Copy subscription lines
  const subLines = db.prepare('SELECT * FROM subscription_lines WHERE subscription_id = ?').all(req.params.subscription_id);
  let subtotal = 0, tax_total = 0;
  for (const l of subLines) {
    const base = (l.unit_price || 0) * (l.qty || 1);
    subtotal  += base;
    tax_total += base * ((l.tax_pct || 0) / 100);
  }
  const grand_total = subtotal + tax_total;

  const result = db.prepare(`
    INSERT INTO invoices (subscription_id, customer_id, issue_date, due_date, billing_period_start,
                          billing_period_end, subtotal, tax_total, grand_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.subscription_id, sub.customer_id, issue_date || null, due_date || null,
         billing_period_start || null, billing_period_end || null, subtotal, tax_total, grand_total);

  const invId = result.lastInsertRowid;
  const invoice_number = padId(invId, 'INV-');
  db.prepare(`UPDATE invoices SET invoice_number=? WHERE id=?`).run(invoice_number, invId);

  const stmt = db.prepare(`
    INSERT INTO invoice_lines (invoice_id, product_id, description, qty, unit_price, tax_pct, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const l of subLines) {
    stmt.run(invId, l.product_id, l.description || null, l.qty, l.unit_price, l.tax_pct, l.line_total);
  }

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
  return res.status(201).json({ data: invoice, message: 'Invoice generated from subscription' });
});

// ── POST /api/invoices/:id/confirm ────────────────────────────────────────────
router.post('/:id/confirm', authorize('admin', 'staff'), (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be confirmed' });

  db.prepare(`UPDATE invoices SET status='confirmed', updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Invoice confirmed' });
});

// ── POST /api/invoices/:id/cancel ─────────────────────────────────────────────
router.post('/:id/cancel', authorize('admin', 'staff'), (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'paid') return res.status(400).json({ error: 'Paid invoices cannot be cancelled' });

  db.prepare(`UPDATE invoices SET status='cancelled', updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Invoice cancelled' });
});

// ── GET /api/invoices/:id/print ───────────────────────────────────────────────
router.get('/:id/print', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*,
           c.company_name, c.phone AS customer_phone, c.address AS customer_address,
           u.name AS customer_name, u.email AS customer_email,
           s.sub_number, s.start_date AS sub_start, s.expiry_date AS sub_expiry,
           pl.name AS plan_name, pl.billing_cycle
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN users u ON u.id = c.user_id
    JOIN subscriptions s ON s.id = i.subscription_id
    JOIN plans pl ON pl.id = s.plan_id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  if (req.user.role === 'customer') {
    const cust = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(invoice.customer_id);
    if (!cust || cust.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  }

  const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ?').all(req.params.id);
  return res.json({ data: { ...invoice, lines }, message: 'Print data ready' });
});

// ── POST /api/invoices/:id/apply-discount ─────────────────────────────────────
router.post('/:id/apply-discount', authorize('admin', 'staff'), (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const discount = db.prepare('SELECT * FROM discounts WHERE code = ? AND is_active = 1').get(code);
  if (!discount) return res.status(404).json({ error: 'Discount code not found or inactive' });

  const today = new Date().toISOString().slice(0, 10);
  if (discount.start_date && today < discount.start_date) {
    return res.status(400).json({ error: 'Discount is not yet active' });
  }
  if (discount.end_date && today > discount.end_date) {
    return res.status(400).json({ error: 'Discount has expired' });
  }
  if (discount.max_uses !== null && discount.uses_count >= discount.max_uses) {
    return res.status(400).json({ error: 'Discount usage limit reached' });
  }
  if (invoice.grand_total < discount.min_amount) {
    return res.status(400).json({ error: `Minimum amount for this discount is ₹${discount.min_amount}` });
  }

  let discount_amount = 0;
  if (discount.type === 'fixed') {
    discount_amount = discount.value;
  } else {
    discount_amount = (invoice.grand_total * discount.value) / 100;
  }

  const new_grand_total = Math.max(0, invoice.grand_total - discount_amount);

  db.prepare(`
    UPDATE invoices SET discount_total=?, grand_total=?, updated_at=datetime('now') WHERE id=?
  `).run(discount_amount, new_grand_total, req.params.id);

  db.prepare(`UPDATE discounts SET uses_count = uses_count + 1 WHERE id = ?`).run(discount.id);

  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: `Discount applied: ₹${discount_amount} off` });
});

module.exports = router;
