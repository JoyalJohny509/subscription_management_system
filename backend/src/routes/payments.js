const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { generateUpiQr } = require('../services/upiQrGenerator');
const { sendPaymentConfirmationEmail } = require('../services/emailService');

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
router.post('/', authorize('admin', 'staff'), async (req, res) => {
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

  // Send payment confirmation email (non-blocking)
  try {
    const customerData = db.prepare(`
      SELECT u.name AS customer_name, u.email AS customer_email
      FROM customers c JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `).get(invoice.customer_id);

    if (customerData && customerData.customer_email) {
      sendPaymentConfirmationEmail({
        to: customerData.customer_email,
        customerName: customerData.customer_name,
        payment,
        invoice,
      }).catch((err) => console.error('[Payment Email Error]', err));
    }
  } catch (emailErr) {
    console.error('[Payment Email Lookup Error]', emailErr);
  }

  return res.status(201).json({ data: payment, message: 'Payment recorded' });
});

// ── GET /api/payments/:invoiceId/upi-qr ───────────────────────────────────────
// Generate UPI QR code for invoice payment
router.get('/:invoiceId/upi-qr', async (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    if (req.user.role === 'customer') {
      const cust = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(invoice.customer_id);
      if (!cust || cust.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }
    if (invoice.status === 'cancelled') {
      return res.status(400).json({ error: 'Invoice has been cancelled' });
    }

    const qrData = await generateUpiQr(invoice);
    return res.json({ data: qrData, message: 'UPI QR code generated' });
  } catch (err) {
    console.error('[UPI QR Error]', err);
    return res.status(500).json({ error: 'Failed to generate UPI QR code' });
  }
});

// ── POST /api/payments/webhook ────────────────────────────────────────────────
// Mock payment webhook — simulates a payment gateway callback
router.post('/webhook', async (req, res) => {
  try {
    const { invoice_id, amount, method, transaction_id, status: paymentStatus } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id is required' });
    }

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const txnStatus = paymentStatus || 'completed';
    const txnAmount = amount || invoice.grand_total;
    const txnMethod = method || 'upi';
    const txnId     = transaction_id || `MOCK-TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Record the payment
    const result = db.prepare(`
      INSERT INTO payments (invoice_id, customer_id, amount, method, payment_date, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoice_id,
      invoice.customer_id,
      txnAmount,
      txnMethod,
      new Date().toISOString().slice(0, 10),
      `Webhook: ${txnId}`,
      txnStatus
    );

    // If payment is successful and covers the grand total, mark invoice as paid
    if (txnStatus === 'completed' && Number(txnAmount) >= Number(invoice.grand_total)) {
      db.prepare(`UPDATE invoices SET status='paid', updated_at=datetime('now') WHERE id=?`).run(invoice_id);
    }

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);

    // Send payment confirmation email (non-blocking) if payment succeeded
    if (txnStatus === 'completed') {
      try {
        const customerData = db.prepare(`
          SELECT u.name AS customer_name, u.email AS customer_email
          FROM customers c JOIN users u ON u.id = c.user_id
          WHERE c.id = ?
        `).get(invoice.customer_id);

        if (customerData && customerData.customer_email) {
          sendPaymentConfirmationEmail({
            to: customerData.customer_email,
            customerName: customerData.customer_name,
            payment,
            invoice,
          }).catch((err) => console.error('[Webhook Email Error]', err));
        }
      } catch (emailErr) {
        console.error('[Webhook Email Lookup Error]', emailErr);
      }
    }

    return res.json({
      data: {
        payment,
        invoice_status: txnStatus === 'completed' && Number(txnAmount) >= Number(invoice.grand_total)
          ? 'paid' : invoice.status,
        transaction_id: txnId,
      },
      message: `Webhook processed: payment ${txnStatus}`,
    });
  } catch (err) {
    console.error('[Webhook Error]', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
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
