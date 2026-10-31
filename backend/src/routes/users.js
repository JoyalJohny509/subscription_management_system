const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must contain uppercase, lowercase, and a special character';
  }
  return null;
}

// ── GET /api/users/profile/me ─────────────────────────────────────────────────
router.get('/profile/me', (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let extra = null;
  if (user.role === 'customer') {
    extra = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
  } else if (user.role === 'staff') {
    extra = db.prepare('SELECT * FROM staff WHERE user_id = ?').get(user.id);
  }

  return res.json({ data: { ...user, profile: extra } });
});

// ── GET /api/users ─────────────────────────────────────────────────────────────
router.get('/', authorize('admin', 'staff'), (req, res) => {
  const { role } = req.query;
  let sql = `
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
           c.id AS customer_id, c.company_name, c.phone AS customer_phone,
           s.department
    FROM users u
    LEFT JOIN customers c ON c.user_id = u.id
    LEFT JOIN staff     s ON s.user_id = u.id
  `;
  const params = [];
  if (role) {
    sql += ` WHERE u.role = ?`;
    params.push(role);
  }
  sql += ` ORDER BY u.id`;

  const users = db.prepare(sql).all(...params);
  return res.json({ data: users, total: users.length });
});

// ── POST /api/users ────────────────────────────────────────────────────────────
router.post('/', authorize('admin'), (req, res) => {
  const { name, email, password, department } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'staff')`
  ).run(name, email, password_hash);

  const userId = result.lastInsertRowid;
  db.prepare(`INSERT INTO staff (user_id, department) VALUES (?, ?)`).run(userId, department || null);

  const user = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(userId);
  return res.status(201).json({ data: user, message: 'Staff account created' });
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
router.get('/:id', authorize('admin', 'staff'), (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
           c.company_name, c.phone AS customer_phone, c.address,
           s.department
    FROM users u
    LEFT JOIN customers c ON c.user_id = u.id
    LEFT JOIN staff     s ON s.user_id = u.id
    WHERE u.id = ?
  `).get(req.params.id);

  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ data: user });
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
router.put('/:id', authorize('admin'), (req, res) => {
  const { name, role, is_active } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(`
    UPDATE users SET
      name      = COALESCE(?, name),
      role      = COALESCE(?, role),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name ?? null, role ?? null, is_active ?? null, req.params.id);

  const updated = db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').get(req.params.id);
  return res.json({ data: updated, message: 'User updated' });
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete('/:id', authorize('admin'), (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(`UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  return res.json({ message: 'User deactivated' });
});

module.exports = router;
