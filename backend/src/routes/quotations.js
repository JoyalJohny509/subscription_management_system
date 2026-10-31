const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcTotals(lines) {
  let subtotal = 0;
  let tax_total = 0;
  for (const line of lines) {
    const base = (line.unit_price || 0) * (line.qty || 1);
    const tax  = base * ((line.tax_pct || 0) / 100);
    subtotal  += base;
    tax_total += tax;
  }
  return { subtotal, tax_total, grand_total: subtotal + tax_total };
}

function padId(id, prefix) {
  return `${prefix}${String(id).padStart(4, '0')}`;
}

// ── GET /api/quotations ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status } = req.query;
  const role = req.user.role;

  let sql = `
    SELECT q.*, c.company_name, u.name AS customer_name
    FROM quotations q
    JOIN customers c ON c.id = q.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'customer') {
    sql += ` AND c.user_id = ?`;
    params.push(req.user.id);
  }
  if (status) { sql += ` AND q.status = ?`; params.push(status); }
  sql += ` ORDER BY q.id DESC`;

  const rows = db.prepare(sql).all(...params);
  return res.json({ data: rows, total: rows.length });
});

// ── POST /api/quotations ───────────────────────────────────────────────────────
router.post('/', authorize('admin', 'staff'), (req, res) => {
  const { customer_id, validity_days, notes, lines } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });

  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const { subtotal, tax_total, grand_total } = calcTotals(lines || []);

  const result = db.prepare(`
    INSERT INTO quotations (customer_id, validity_days, notes, subtotal, tax_total, grand_total)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(customer_id, validity_days || 30, notes || null, subtotal, tax_total, grand_total);

  const qId = result.lastInsertRowid;
  const quotation_number = padId(qId, 'QUO-');
  db.prepare(`UPDATE quotations SET quotation_number = ? WHERE id = ?`).run(quotation_number, qId);

  // Insert lines
  if (Array.isArray(lines)) {
    const lineStmt = db.prepare(`
      INSERT INTO quotation_lines (quotation_id, product_id, plan_id, variant_id, qty, unit_price, tax_pct, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of lines) {
      const base = (l.unit_price || 0) * (l.qty || 1);
      const tax  = base * ((l.tax_pct || 0) / 100);
      lineStmt.run(qId, l.product_id, l.plan_id || null, l.variant_id || null,
                   l.qty || 1, l.unit_price || 0, l.tax_pct || 0, base + tax);
    }
  }

  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(qId);
  return res.status(201).json({ data: quotation, message: 'Quotation created' });
});

// ── GET /api/quotations/:id ───────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const quotation = db.prepare(`
    SELECT q.*, c.company_name, u.name AS customer_name
    FROM quotations q
    JOIN customers c ON c.id = q.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE q.id = ?
  `).get(req.params.id);

  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

  // Customer access control
  if (req.user.role === 'customer') {
    const cust = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(quotation.customer_id);
    if (!cust || cust.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  }

  const lines = db.prepare('SELECT * FROM quotation_lines WHERE quotation_id = ?').all(req.params.id);
  return res.json({ data: { ...quotation, lines } });
});

// ── PUT /api/quotations/:id ───────────────────────────────────────────────────
router.put('/:id', authorize('admin', 'staff'), (req, res) => {
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
  if (quotation.status !== 'draft') return res.status(400).json({ error: 'Only draft quotations can be updated' });

  const { validity_days, notes, lines } = req.body;

  if (Array.isArray(lines)) {
    db.prepare('DELETE FROM quotation_lines WHERE quotation_id = ?').run(req.params.id);
    const lineStmt = db.prepare(`
      INSERT INTO quotation_lines (quotation_id, product_id, plan_id, variant_id, qty, unit_price, tax_pct, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of lines) {
      const base = (l.unit_price || 0) * (l.qty || 1);
      const tax  = base * ((l.tax_pct || 0) / 100);
      lineStmt.run(req.params.id, l.product_id, l.plan_id || null, l.variant_id || null,
                   l.qty || 1, l.unit_price || 0, l.tax_pct || 0, base + tax);
    }
    const newLines = db.prepare('SELECT * FROM quotation_lines WHERE quotation_id = ?').all(req.params.id);
    const { subtotal, tax_total, grand_total } = calcTotals(newLines.map(l => ({
      unit_price: l.unit_price, qty: l.qty, tax_pct: l.tax_pct
    })));
    db.prepare(`UPDATE quotations SET subtotal=?, tax_total=?, grand_total=?, updated_at=datetime('now') WHERE id=?`).run(subtotal, tax_total, grand_total, req.params.id);
  }

  db.prepare(`UPDATE quotations SET validity_days=COALESCE(?,validity_days), notes=COALESCE(?,notes), updated_at=datetime('now') WHERE id=?`)
    .run(validity_days ?? null, notes ?? null, req.params.id);

  const updated = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Quotation updated' });
});

// ── DELETE /api/quotations/:id ────────────────────────────────────────────────
router.delete('/:id', authorize('admin'), (req, res) => {
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
  if (quotation.status !== 'draft') return res.status(400).json({ error: 'Only draft quotations can be deleted' });

  db.prepare('DELETE FROM quotation_lines WHERE quotation_id = ?').run(req.params.id);
  db.prepare('DELETE FROM quotations WHERE id = ?').run(req.params.id);
  return res.json({ message: 'Quotation deleted' });
});

// ── POST /api/quotations/:id/send ─────────────────────────────────────────────
router.post('/:id/send', authorize('admin', 'staff'), (req, res) => {
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
  if (quotation.status !== 'draft') return res.status(400).json({ error: 'Only draft quotations can be sent' });

  db.prepare(`UPDATE quotations SET status='sent', updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  const updated = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Quotation sent' });
});

// ── POST /api/quotations/:id/accept ──────────────────────────────────────────
router.post('/:id/accept', authorize('admin', 'staff'), (req, res) => {
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
  if (!['draft','sent'].includes(quotation.status)) {
    return res.status(400).json({ error: 'Only draft or sent quotations can be accepted' });
  }

  db.prepare(`UPDATE quotations SET status='accepted', updated_at=datetime('now') WHERE id=?`).run(req.params.id);

  // Need a plan_id — get from first quotation_line
  const firstLine = db.prepare('SELECT plan_id FROM quotation_lines WHERE quotation_id = ? AND plan_id IS NOT NULL LIMIT 1').get(req.params.id);
  const plan_id = firstLine ? firstLine.plan_id : req.body.plan_id;
  if (!plan_id) return res.status(400).json({ error: 'Cannot determine plan_id for subscription. Provide plan_id in body or ensure a quotation line has a plan.' });

  // Create subscription
  const subResult = db.prepare(`
    INSERT INTO subscriptions (customer_id, plan_id, quotation_id, status, subtotal, tax_total, discount_total, grand_total)
    VALUES (?, ?, ?, 'quotation', ?, ?, ?, ?)
  `).run(quotation.customer_id, plan_id, quotation.id,
         quotation.subtotal, quotation.tax_total, quotation.discount_total, quotation.grand_total);

  const subId = subResult.lastInsertRowid;
  const sub_number = padId(subId, 'SUB-');
  db.prepare(`UPDATE subscriptions SET sub_number=? WHERE id=?`).run(sub_number, subId);

  // Copy lines
  const qLines = db.prepare('SELECT * FROM quotation_lines WHERE quotation_id = ?').all(req.params.id);
  const subLineStmt = db.prepare(`
    INSERT INTO subscription_lines (subscription_id, product_id, variant_id, qty, unit_price, tax_pct, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const l of qLines) {
    subLineStmt.run(subId, l.product_id, l.variant_id, l.qty, l.unit_price, l.tax_pct, l.line_total);
  }

  const updatedQuotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  const subscription     = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);
  return res.json({ data: { quotation: updatedQuotation, subscription }, message: 'Quotation accepted and subscription created' });
});

// ── POST /api/quotations/:id/reject ──────────────────────────────────────────
router.post('/:id/reject', authorize('admin', 'staff'), (req, res) => {
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

  db.prepare(`UPDATE quotations SET status='rejected', updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  const updated = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Quotation rejected' });
});

module.exports = router;
