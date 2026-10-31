const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);

// ── POST /api/discounts/validate ──────────────────────────────────────────────
// Note: placed before /:id routes to avoid conflict
router.post('/validate', (req, res) => {
  const { code, amount, qty } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

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
  if (amount !== undefined && Number(amount) < discount.min_amount) {
    return res.status(400).json({ error: `Minimum amount is ₹${discount.min_amount}` });
  }
  if (qty !== undefined && Number(qty) < discount.min_qty) {
    return res.status(400).json({ error: `Minimum quantity is ${discount.min_qty}` });
  }

  let computed_discount = 0;
  if (amount !== undefined) {
    computed_discount = discount.type === 'fixed'
      ? discount.value
      : (Number(amount) * discount.value) / 100;
  }

  return res.json({ data: { discount, computed_discount }, message: 'Discount is valid' });
});

// ── GET /api/discounts ─────────────────────────────────────────────────────────
router.get('/', authorize('admin', 'staff'), (req, res) => {
  const discounts = db.prepare('SELECT * FROM discounts ORDER BY id').all();
  return res.json({ data: discounts, total: discounts.length });
});

// ── POST /api/discounts ────────────────────────────────────────────────────────
router.post('/', authorize('admin'), (req, res) => {
  const { code, name, type, value, min_amount, min_qty, start_date, end_date, max_uses, applicable_to } = req.body;
  if (!code || !type || value === undefined) {
    return res.status(400).json({ error: 'code, type, and value are required' });
  }

  const existing = db.prepare('SELECT id FROM discounts WHERE code = ?').get(code);
  if (existing) return res.status(409).json({ error: 'Discount code already exists' });

  const result = db.prepare(`
    INSERT INTO discounts (code, name, type, value, min_amount, min_qty, start_date, end_date, max_uses, applicable_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, name || null, type, value, min_amount || 0, min_qty || 1,
         start_date || null, end_date || null, max_uses || null, applicable_to || 'all');

  const discount = db.prepare('SELECT * FROM discounts WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ data: discount, message: 'Discount created' });
});

// ── GET /api/discounts/:id ─────────────────────────────────────────────────────
router.get('/:id', authorize('admin', 'staff'), (req, res) => {
  const discount = db.prepare('SELECT * FROM discounts WHERE id = ?').get(req.params.id);
  if (!discount) return res.status(404).json({ error: 'Discount not found' });
  return res.json({ data: discount });
});

// ── PUT /api/discounts/:id ─────────────────────────────────────────────────────
router.put('/:id', authorize('admin'), (req, res) => {
  const discount = db.prepare('SELECT id FROM discounts WHERE id = ?').get(req.params.id);
  if (!discount) return res.status(404).json({ error: 'Discount not found' });

  const { name, type, value, min_amount, min_qty, start_date, end_date, max_uses, applicable_to, is_active } = req.body;
  db.prepare(`
    UPDATE discounts SET
      name          = COALESCE(?, name),
      type          = COALESCE(?, type),
      value         = COALESCE(?, value),
      min_amount    = COALESCE(?, min_amount),
      min_qty       = COALESCE(?, min_qty),
      start_date    = COALESCE(?, start_date),
      end_date      = COALESCE(?, end_date),
      max_uses      = COALESCE(?, max_uses),
      applicable_to = COALESCE(?, applicable_to),
      is_active     = COALESCE(?, is_active)
    WHERE id = ?
  `).run(name ?? null, type ?? null, value ?? null, min_amount ?? null, min_qty ?? null,
         start_date ?? null, end_date ?? null, max_uses ?? null, applicable_to ?? null,
         is_active ?? null, req.params.id);

  const updated = db.prepare('SELECT * FROM discounts WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Discount updated' });
});

// ── DELETE /api/discounts/:id ──────────────────────────────────────────────────
router.delete('/:id', authorize('admin'), (req, res) => {
  const discount = db.prepare('SELECT id FROM discounts WHERE id = ?').get(req.params.id);
  if (!discount) return res.status(404).json({ error: 'Discount not found' });

  db.prepare('DELETE FROM discounts WHERE id = ?').run(req.params.id);
  return res.json({ message: 'Discount deleted' });
});

module.exports = router;
