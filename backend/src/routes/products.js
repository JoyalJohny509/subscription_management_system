const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);

// ── GET /api/products ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { is_active, search } = req.query;
  let sql = `
    SELECT p.*,
           COUNT(v.id) AS variant_count,
           COUNT(v.id) AS variants_count
    FROM products p
    LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1
    WHERE 1=1
  `;
  const params = [];
  if (is_active !== undefined) {
    sql += ` AND p.is_active = ?`;
    params.push(Number(is_active));
  }
  if (search) {
    sql += ` AND (p.name LIKE ? OR p.type LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ` GROUP BY p.id ORDER BY p.id`;

  const products = db.prepare(sql).all(...params);
  return res.json({ data: products, total: products.length });
});

// ── POST /api/products ─────────────────────────────────────────────────────────
router.post('/', authorize('admin', 'staff'), (req, res) => {
  const { name, type, sales_price, cost_price, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db.prepare(
    `INSERT INTO products (name, type, sales_price, cost_price, notes) VALUES (?, ?, ?, ?, ?)`
  ).run(name, type || null, sales_price || 0, cost_price || 0, notes || null);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ data: product, message: 'Product created' });
});

// ── GET /api/products/:id ─────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(req.params.id);
  return res.json({ data: { ...product, variants } });
});

// ── PUT /api/products/:id ─────────────────────────────────────────────────────
router.put('/:id', authorize('admin', 'staff'), (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const { name, type, sales_price, cost_price, notes, is_active } = req.body;
  db.prepare(`
    UPDATE products SET
      name        = COALESCE(?, name),
      type        = COALESCE(?, type),
      sales_price = COALESCE(?, sales_price),
      cost_price  = COALESCE(?, cost_price),
      notes       = COALESCE(?, notes),
      is_active   = COALESCE(?, is_active),
      updated_at  = datetime('now')
    WHERE id = ?
  `).run(name ?? null, type ?? null, sales_price ?? null, cost_price ?? null, notes ?? null, is_active ?? null, req.params.id);

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'Product updated' });
});

// ── DELETE /api/products/:id ──────────────────────────────────────────────────
router.delete('/:id', authorize('admin'), (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  db.prepare(`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  return res.json({ message: 'Product deactivated' });
});

// ── GET /api/products/:id/variants ────────────────────────────────────────────
router.get('/:id/variants', (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(req.params.id);
  return res.json({ data: variants, total: variants.length });
});

// ── POST /api/products/:id/variants ──────────────────────────────────────────
router.post('/:id/variants', authorize('admin', 'staff'), (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const { name, additional_price } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db.prepare(
    `INSERT INTO product_variants (product_id, name, additional_price) VALUES (?, ?, ?)`
  ).run(req.params.id, name, additional_price || 0);

  const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ data: variant, message: 'Variant created' });
});

// ── PUT /api/products/:id/variants/:vid ──────────────────────────────────────
router.put('/:id/variants/:vid', authorize('admin', 'staff'), (req, res) => {
  const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(req.params.vid, req.params.id);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });

  const { name, additional_price, is_active } = req.body;
  db.prepare(`
    UPDATE product_variants SET
      name             = COALESCE(?, name),
      additional_price = COALESCE(?, additional_price),
      is_active        = COALESCE(?, is_active)
    WHERE id = ?
  `).run(name ?? null, additional_price ?? null, is_active ?? null, req.params.vid);

  const updated = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(req.params.vid);
  return res.json({ data: updated, message: 'Variant updated' });
});

// ── DELETE /api/products/:id/variants/:vid ────────────────────────────────────
router.delete('/:id/variants/:vid', authorize('admin'), (req, res) => {
  const variant = db.prepare('SELECT id FROM product_variants WHERE id = ? AND product_id = ?').get(req.params.vid, req.params.id);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });

  db.prepare('DELETE FROM product_variants WHERE id = ?').run(req.params.vid);
  return res.json({ message: 'Variant deleted' });
});

module.exports = router;
