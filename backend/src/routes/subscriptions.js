const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { runBillingJob } = require('../jobs/billingCron');
const { upgradeSeats, addAddon } = require('../services/prorationService');

const router = express.Router();
router.use(authenticate);

function padId(id, prefix) {
  return `${prefix}${String(id).padStart(4, '0')}`;
}

// ── GET /api/subscriptions ────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status } = req.query;
  const role = req.user.role;

  let sql = `
    SELECT s.*, c.company_name, u.name AS customer_name, pl.name AS plan_name
    FROM subscriptions s
    JOIN customers c ON c.id = s.customer_id
    JOIN users u ON u.id = c.user_id
    JOIN plans pl ON pl.id = s.plan_id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'customer') {
    sql += ` AND c.user_id = ?`;
    params.push(req.user.id);
  }
  if (status) { sql += ` AND s.status = ?`; params.push(status); }
  sql += ` ORDER BY s.id DESC`;

  const rows = db.prepare(sql).all(...params);
  return res.json({ data: rows, total: rows.length });
});

// ── POST /api/subscriptions ───────────────────────────────────────────────────
router.post('/', authorize('admin', 'staff'), (req, res) => {
  const { customer_id, plan_id, start_date, expiry_date, payment_terms, notes, lines } = req.body;
  if (!customer_id || !plan_id) return res.status(400).json({ error: 'customer_id and plan_id are required' });

  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const plan = db.prepare('SELECT id FROM plans WHERE id = ?').get(plan_id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

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
    INSERT INTO subscriptions (customer_id, plan_id, status, start_date, expiry_date, payment_terms, notes, subtotal, tax_total, grand_total)
    VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, plan_id, start_date || null, expiry_date || null, payment_terms || 'immediate', notes || null, subtotal, tax_total, grand_total);

  const subId = result.lastInsertRowid;
  const sub_number = padId(subId, 'SUB-');
  db.prepare(`UPDATE subscriptions SET sub_number=? WHERE id=?`).run(sub_number, subId);

  if (Array.isArray(lines)) {
    const stmt = db.prepare(`
      INSERT INTO subscription_lines (subscription_id, product_id, variant_id, description, qty, unit_price, tax_pct, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of lines) {
      const base = (l.unit_price || 0) * (l.qty || 1);
      const tax  = base * ((l.tax_pct || 0) / 100);
      stmt.run(subId, l.product_id, l.variant_id || null, l.description || null, l.qty || 1, l.unit_price || 0, l.tax_pct || 0, base + tax);
    }
  }

  const subscription = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);
  return res.status(201).json({ data: subscription, message: 'Subscription created' });
});

// ── GET /api/subscriptions/:id ────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const subscription = db.prepare(`
    SELECT s.*, c.company_name, u.name AS customer_name, u.email AS customer_email,
           pl.name AS plan_name, pl.billing_cycle
    FROM subscriptions s
    JOIN customers c ON c.id = s.customer_id
    JOIN users u ON u.id = c.user_id
    JOIN plans pl ON pl.id = s.plan_id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!subscription) return res.status(404).json({ error: 'Subscription not found' });

  if (req.user.role === 'customer') {
    const cust = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(subscription.customer_id);
    if (!cust || cust.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  }

  const lines = db.prepare('SELECT * FROM subscription_lines WHERE subscription_id = ?').all(req.params.id);
  return res.json({ data: { ...subscription, lines } });
});

// ── PUT /api/subscriptions/:id ────────────────────────────────────────────────
router.put('/:id', authorize('admin', 'staff'), (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  if (!['draft', 'quotation'].includes(sub.status)) {
    return res.status(400).json({ error: 'Only draft or quotation subscriptions can be updated' });
  }

  const { start_date, expiry_date, payment_terms, notes } = req.body;
  db.prepare(`
    UPDATE subscriptions SET
      start_date    = COALESCE(?, start_date),
      expiry_date   = COALESCE(?, expiry_date),
      payment_terms = COALESCE(?, payment_terms),
      notes         = COALESCE(?, notes),
      updated_at    = datetime('now')
    WHERE id = ?
  `).run(start_date ?? null, expiry_date ?? null, payment_terms ?? null, notes ?? null, req.params.id);

  const updated = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Subscription updated' });
});

// ── Status transition helpers ──────────────────────────────────────────────────
function transition(from, to) {
  return (req, res) => {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    if (Array.isArray(from) ? !from.includes(sub.status) : sub.status !== from) {
      return res.status(400).json({ error: `Subscription must be in status: ${Array.isArray(from) ? from.join('/') : from}` });
    }
    db.prepare(`UPDATE subscriptions SET status=?, updated_at=datetime('now') WHERE id=?`).run(to, req.params.id);
    const updated = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
    return res.json({ data: updated, message: `Subscription ${to}` });
  };
}

// ── POST /api/subscriptions/:id/confirm ──────────────────────────────────────
router.post('/:id/confirm', authorize('admin', 'staff'), transition(['draft', 'quotation'], 'confirmed'));

// ── POST /api/subscriptions/:id/activate ─────────────────────────────────────
router.post('/:id/activate', authorize('admin', 'staff'), transition('confirmed', 'active'));

// ── POST /api/subscriptions/:id/pause ────────────────────────────────────────
router.post('/:id/pause', authorize('admin', 'staff'), (req, res) => {
  const sub = db.prepare('SELECT s.*, pl.allow_pause FROM subscriptions s JOIN plans pl ON pl.id = s.plan_id WHERE s.id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  if (sub.status !== 'active') return res.status(400).json({ error: 'Only active subscriptions can be paused' });
  if (!sub.allow_pause) return res.status(400).json({ error: 'Plan does not allow pausing' });

  db.prepare(`UPDATE subscriptions SET status='paused', updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  const updated = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Subscription paused' });
});

// ── POST /api/subscriptions/:id/close ────────────────────────────────────────
router.post('/:id/close', authorize('admin', 'staff'), transition(['active', 'paused', 'confirmed'], 'closed'));

// ── POST /api/subscriptions/trigger-billing-cron ──────────────────────────────
router.post('/trigger-billing-cron', authorize('admin', 'staff'), (req, res) => {
  try {
    const { target_date } = req.body || {};
    const summary = runBillingJob(target_date || null);
    return res.json({
      message: 'Billing cron job executed successfully',
      data: summary
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/subscriptions/:id/upgrade-seats ─────────────────────────────────
router.post('/:id/upgrade-seats', (req, res) => {
  try {
    const sub = db.prepare('SELECT customer_id FROM subscriptions WHERE id = ?').get(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    // Customer can only modify their own subscription
    if (req.user.role === 'customer') {
      const cust = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(sub.customer_id);
      if (!cust || cust.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    }

    const { line_id, new_qty, effective_date } = req.body;
    if (new_qty === undefined || new_qty === null) {
      return res.status(400).json({ error: 'new_qty is required' });
    }

    const result = upgradeSeats({
      subscriptionId: req.params.id,
      lineId: line_id || null,
      newQty: new_qty,
      effectiveDate: effective_date || null
    });

    return res.json({
      message: 'Seats adjusted successfully with pro-rated billing calculation',
      data: result
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── POST /api/subscriptions/:id/add-addon ─────────────────────────────────────
router.post('/:id/add-addon', (req, res) => {
  try {
    const sub = db.prepare('SELECT customer_id FROM subscriptions WHERE id = ?').get(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    if (req.user.role === 'customer') {
      const cust = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(sub.customer_id);
      if (!cust || cust.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    }

    const { product_id, variant_id, description, qty, unit_price, tax_pct, effective_date } = req.body;
    if (!product_id || unit_price === undefined) {
      return res.status(400).json({ error: 'product_id and unit_price are required' });
    }

    const result = addAddon({
      subscriptionId: req.params.id,
      productId: product_id,
      variantId: variant_id || null,
      description: description || null,
      qty: qty || 1,
      unitPrice: unit_price,
      taxPct: tax_pct || 0,
      effectiveDate: effective_date || null
    });

    return res.json({
      message: 'Add-on added successfully with pro-rated billing calculation',
      data: result
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
