const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);

const VALID_CYCLES = ['daily', 'weekly', 'monthly', 'yearly'];

function toIntBool(val, def = 0) {
  if (val === undefined || val === null) return def;
  return (val === true || val === 1 || val === '1' || val === 'true') ? 1 : 0;
}

function toIntBoolOrNull(val) {
  if (val === undefined || val === null) return null;
  return (val === true || val === 1 || val === '1' || val === 'true') ? 1 : 0;
}

// ── GET /api/plans ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { billing_cycle, product_id } = req.query;
  let sql = `
    SELECT pl.*, p.name AS product_name
    FROM plans pl
    JOIN products p ON p.id = pl.product_id
    WHERE 1=1
  `;
  const params = [];
  if (billing_cycle) { sql += ` AND pl.billing_cycle = ?`; params.push(billing_cycle); }
  if (product_id) { sql += ` AND pl.product_id = ?`; params.push(product_id); }
  sql += ` ORDER BY pl.id`;

  const plans = db.prepare(sql).all(...params);
  return res.json({ data: plans, total: plans.length });
});

// ── POST /api/plans ────────────────────────────────────────────────────────────
router.post('/', authorize('admin'), (req, res) => {
  const { name, product_id, billing_cycle, price, min_qty, start_date, end_date,
          auto_close, allow_pause, allow_early_close, allow_renewal, is_active } = req.body;

  if (!name || !product_id || !billing_cycle || price === undefined) {
    return res.status(400).json({ error: 'name, product_id, billing_cycle, and price are required' });
  }

  if (!VALID_CYCLES.includes(billing_cycle)) {
    return res.status(400).json({ error: `billing_cycle must be one of: ${VALID_CYCLES.join(', ')}` });
  }

  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const result = db.prepare(`
    INSERT INTO plans (name, product_id, billing_cycle, price, min_qty, start_date, end_date,
                       auto_close, allow_pause, allow_early_close, allow_renewal, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    Number(product_id),
    billing_cycle,
    Number(price),
    Number(min_qty) || 1,
    start_date || null,
    end_date || null,
    toIntBool(auto_close, 0),
    toIntBool(allow_pause, 1),
    toIntBool(allow_early_close, 1),
    toIntBool(allow_renewal, 1),
    toIntBool(is_active, 1)
  );

  const plan = db.prepare('SELECT pl.*, p.name AS product_name FROM plans pl JOIN products p ON p.id = pl.product_id WHERE pl.id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ data: plan, message: 'Plan created' });
});

// ── GET /api/plans/:id ────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const plan = db.prepare(`
    SELECT pl.*, p.name AS product_name, p.type AS product_type
    FROM plans pl
    JOIN products p ON p.id = pl.product_id
    WHERE pl.id = ?
  `).get(req.params.id);

  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  return res.json({ data: plan });
});

// ── PUT /api/plans/:id ────────────────────────────────────────────────────────
router.put('/:id', authorize('admin'), (req, res) => {
  const plan = db.prepare('SELECT id FROM plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const { name, billing_cycle, price, min_qty, start_date, end_date,
    auto_close, allow_pause, allow_early_close, allow_renewal, is_active } = req.body;

  if (billing_cycle && !VALID_CYCLES.includes(billing_cycle)) {
    return res.status(400).json({ error: `billing_cycle must be one of: ${VALID_CYCLES.join(', ')}` });
  }

  db.prepare(`
    UPDATE plans SET
      name              = COALESCE(?, name),
      billing_cycle     = COALESCE(?, billing_cycle),
      price             = COALESCE(?, price),
      min_qty           = COALESCE(?, min_qty),
      start_date        = COALESCE(?, start_date),
      end_date          = COALESCE(?, end_date),
      auto_close        = COALESCE(?, auto_close),
      allow_pause       = COALESCE(?, allow_pause),
      allow_early_close = COALESCE(?, allow_early_close),
      allow_renewal     = COALESCE(?, allow_renewal),
      is_active         = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    name ?? null,
    billing_cycle ?? null,
    price !== undefined ? Number(price) : null,
    min_qty !== undefined ? Number(min_qty) : null,
    start_date ?? null,
    end_date ?? null,
    toIntBoolOrNull(auto_close),
    toIntBoolOrNull(allow_pause),
    toIntBoolOrNull(allow_early_close),
    toIntBoolOrNull(allow_renewal),
    toIntBoolOrNull(is_active),
    req.params.id
  );

  const updated = db.prepare('SELECT pl.*, p.name AS product_name FROM plans pl JOIN products p ON p.id = pl.product_id WHERE pl.id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Plan updated' });
});

// ── DELETE /api/plans/:id ─────────────────────────────────────────────────────
router.delete('/:id', authorize('admin'), (req, res) => {
  const plan = db.prepare('SELECT id FROM plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  db.prepare('UPDATE plans SET is_active = 0 WHERE id = ?').run(req.params.id);
  return res.json({ message: 'Plan deactivated' });
});

module.exports = router;
