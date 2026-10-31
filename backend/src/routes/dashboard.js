const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));

// ── GET /api/dashboard/summary ────────────────────────────────────────────────
router.get('/summary', (req, res) => {
  const active_subscriptions = db.prepare(
    `SELECT COUNT(*) AS cnt FROM subscriptions WHERE status = 'active'`
  ).get().cnt;

  const total_revenue = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'completed'`
  ).get().total;

  const outstanding = db.prepare(
    `SELECT COALESCE(SUM(grand_total), 0) AS total FROM invoices WHERE status = 'confirmed'`
  ).get().total;

  const today = new Date().toISOString().slice(0, 10);
  const overdue_invoices = db.prepare(
    `SELECT COUNT(*) AS cnt FROM invoices WHERE status = 'confirmed' AND due_date < ?`
  ).get(today).cnt;

  const monthly_revenue = db.prepare(`
    SELECT strftime('%Y-%m', payment_date) AS month,
           SUM(amount) AS amount
    FROM payments
    WHERE status = 'completed'
      AND payment_date >= date('now', '-6 months')
    GROUP BY month
    ORDER BY month
  `).all();

  const recent_invoices = db.prepare(`
    SELECT i.id, i.invoice_number, i.status, i.grand_total, i.issue_date,
           u.name AS customer_name
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN users u ON u.id = c.user_id
    ORDER BY i.id DESC
    LIMIT 5
  `).all();

  const subscription_status_breakdown = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM subscriptions
    GROUP BY status
  `).all();

  return res.json({
    data: {
      active_subscriptions,
      total_revenue,
      outstanding,
      overdue_invoices,
      monthly_revenue,
      recent_invoices,
      subscription_status_breakdown,
    },
  });
});

// ── GET /api/dashboard/reports/revenue ────────────────────────────────────────
router.get('/reports/revenue', (req, res) => {
  const { from, to } = req.query;
  let sql = `
    SELECT strftime('%Y-%m', payment_date) AS month,
           SUM(amount) AS amount
    FROM payments
    WHERE status = 'completed'
  `;
  const params = [];
  if (from) { sql += ` AND payment_date >= ?`; params.push(from); }
  if (to)   { sql += ` AND payment_date <= ?`; params.push(to); }
  sql += ` GROUP BY month ORDER BY month`;

  const rows = db.prepare(sql).all(...params);
  return res.json({ data: rows, total: rows.length });
});

// ── GET /api/dashboard/reports/subscriptions ──────────────────────────────────
router.get('/reports/subscriptions', (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.sub_number, s.status, s.start_date, s.expiry_date, s.grand_total,
           u.name AS customer_name, c.company_name,
           pl.name AS plan_name, pl.billing_cycle
    FROM subscriptions s
    JOIN customers c ON c.id = s.customer_id
    JOIN users u ON u.id = c.user_id
    JOIN plans pl ON pl.id = s.plan_id
    ORDER BY s.id DESC
  `).all();

  return res.json({ data: rows, total: rows.length });
});

// ── GET /api/dashboard/reports/overdue ────────────────────────────────────────
router.get('/reports/overdue', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT i.id, i.invoice_number, i.due_date, i.grand_total, i.status,
           u.name AS customer_name, c.company_name
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN users u ON u.id = c.user_id
    WHERE i.status = 'confirmed' AND i.due_date < ?
    ORDER BY i.due_date ASC
  `).all(today);

  return res.json({ data: rows, total: rows.length });
});

module.exports = router;
