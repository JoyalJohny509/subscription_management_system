const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { generateToken } = require('../middleware/auth');
const { registerSchema, loginSchema } = require('../validations/authValidation');
const validate = require('../middleware/validate');
const { authRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must contain uppercase, lowercase, and a special character';
  }
  return null;
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', authRateLimiter, validate(registerSchema), (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const password_hash = bcrypt.hashSync(password, 10);

  const result = db.prepare(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')`
  ).run(name, email, password_hash);

  const userId = result.lastInsertRowid;

  // Create customer record
  db.prepare(`INSERT INTO customers (user_id) VALUES (?)`).run(userId);

  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId);
  const token = generateToken(user);

  return res.status(201).json({ data: { user, token }, message: 'Registration successful' });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', authRateLimiter, validate(loginSchema), (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = generateToken(user);

  return res.json({
    data: {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    },
    message: 'Login successful',
  });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    // Do not leak whether the email exists
    return res.json({ message: 'Reset code sent to console (dev mode)' });
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[DEV] Password reset code for ${email}: ${resetCode}`);

  return res.json({ message: 'Reset code sent to console (dev mode)' });
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'email and newPassword are required' });
  }

  const pwError = validatePassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Dev mode: skip code verification
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(newHash, user.id);

  return res.json({ message: 'Password reset successfully' });
});

module.exports = router;
