const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);

// ── GET /api/payments/invoice/:invoice_id ─────────────────────────────────────
// Placed before /:id to avoid route conflict
router.get('/invoice/:invoice_id', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.invoice_id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  if (req.user.role === 'customer') {
    const cust = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(invoice.customer_id);
    if (!cust || cust.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  }

  const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY id').all(req.params.invoice_id);
  return res.json({ data: payments, total: payments.length });
});

// ── GET /api/payments ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status } = req.query;
  const role = req.user.role;

  let sql = `
    SELECT p.*, i.invoice_number, c.company_name, u.name AS customer_name
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    JOIN customers c ON c.id = p.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'customer') {
    sql += ` AND c.user_id = ?`;
    params.push(req.user.id);
  }
  if (status) { sql += ` AND p.status = ?`; params.push(status); }
  sql += ` ORDER BY p.id DESC`;

  const rows = db.prepare(sql).all(...params);
  return res.json({ data: rows, total: rows.length });
});

// ── POST /api/payments ─────────────────────────────────────────────────────────
router.post('/', authorize('admin', 'staff'), (req, res) => {
  const { invoice_id, amount, method, payment_date, notes } = req.body;
  if (!invoice_id || amount === undefined || !method) {
    return res.status(400).json({ error: 'invoice_id, amount, and method are required' });
  }

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const result = db.prepare(`
    INSERT INTO payments (invoice_id, customer_id, amount, method, payment_date, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, 'completed')
  `).run(invoice_id, invoice.customer_id, amount, method, payment_date || new Date().toISOString().slice(0, 10), notes || null);

  // Auto-mark invoice as paid if amount >= grand_total
  if (Number(amount) >= Number(invoice.grand_total)) {
    db.prepare(`UPDATE invoices SET status='paid', updated_at=datetime('now') WHERE id=?`).run(invoice_id);
  }

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ data: payment, message: 'Payment recorded' });
});

// ── GET /api/payments/:id ─────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const payment = db.prepare(`
    SELECT p.*, i.invoice_number, c.company_name, u.name AS customer_name
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    JOIN customers c ON c.id = p.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (req.user.role === 'customer') {
    const cust = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(payment.customer_id);
    if (!cust || cust.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json({ data: payment });
});

// ── PUT /api/payments/:id ─────────────────────────────────────────────────────
router.put('/:id', authorize('admin', 'staff'), (req, res) => {
  const payment = db.prepare('SELECT id FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const { notes, status } = req.body;
  db.prepare(`
    UPDATE payments SET
      notes  = COALESCE(?, notes),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(notes ?? null, status ?? null, req.params.id);

  const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Payment updated' });
});

module.exports = router;
