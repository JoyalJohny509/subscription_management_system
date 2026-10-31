/**
 * Auth API Tests — Jest + Supertest
 *
 * Strategy:
 *  1. Mock `../db/database` with an in-memory SQLite database so the real
 *     brightloop.db is never touched.
 *  2. Mock `../middleware/rateLimiter` with a pass-through so the 5-req limit
 *     never blocks the test suite.
 *  3. Require `../index` AFTER mocks are set up — Jest hoists jest.mock() calls
 *     to the top automatically, so every module that requires database.js or
 *     rateLimiter.js gets the mocked version instead.
 *  4. Pass `app` to supertest — it opens its own temporary server on a random
 *     port and closes it when done. No port conflicts.
 */

// ── Mock 1: swap brightloop.db with an in-memory SQLite database ─────────────
jest.mock('../db/database', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
});

// ── Mock 2: disable rate limiter so 429s never interrupt the test suite ───────
jest.mock('../middleware/rateLimiter', () => ({
  authRateLimiter: (req, res, next) => next()
}));

// ── Load app AFTER mocks are registered ──────────────────────────────────────
const request = require('supertest');
process.env.PORT = '0';           // use a random free port — avoids EADDRINUSE if dev server is running
const app = require('../index'); // initializeDB() runs here on the in-memory DB
const db = require('../db/database'); // same in-memory instance — used for cleanup

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register — Zod validation', () => {

  test('returns 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'not-an-email',   // ← invalid
        password: 'Valid@1234'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    // Confirm the failing field is email
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toContain('email');
  });

  test('returns 400 when password is too weak', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'user@example.com',
        password: 'weak'         // ← too short, no uppercase, no special char
      });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toContain('password');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login — Zod validation', () => {

  test('returns 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'not-an-email',   // ← invalid
        password: 'AnyPassword1!'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toContain('email');
  });

  test('returns 400 when password is empty', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user@example.com',
        password: ''             // ← empty
      });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toContain('password');
  });

});

// shared test user used by the database-level tests below
const VALID_USER = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Valid@1234'
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register — database logic
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register — database logic', () => {

  beforeEach(() => {
    // wipe tables so each test starts from a clean slate
    db.exec('DELETE FROM customers');
    db.exec('DELETE FROM users');
  });

  test('returns 201 with token and user email on successful registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(VALID_USER);

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.email).toBe(VALID_USER.email);
  });

  test('returns 409 when the same email is registered twice', async () => {
    // first registration — should succeed
    await request(app).post('/api/auth/register').send(VALID_USER);

    // second registration with the same email
    const res = await request(app)
      .post('/api/auth/register')
      .send(VALID_USER);

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error', 'Email already in use');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login — database logic
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login — database logic', () => {

  beforeEach(async () => {
    // fresh tables + pre-register a user before every login test
    db.exec('DELETE FROM customers');
    db.exec('DELETE FROM users');
    await request(app).post('/api/auth/register').send(VALID_USER);
  });

  test('returns 200 with token and user on successful login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toHaveProperty('email', VALID_USER.email);
  });

  test('returns 401 with Invalid credentials on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: 'WrongPass@99' });

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  test('returns 401 with Invalid credentials for a non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: VALID_USER.password });

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Extra auth tests — improve coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('Extra authentication tests', () => {

  beforeEach(async () => {
    db.exec('DELETE FROM customers');
    db.exec('DELETE FROM users');

    await request(app)
      .post('/api/auth/register')
      .send(VALID_USER);
  });

  test('returns 403 when an inactive user tries to log in', async () => {
    db.prepare('UPDATE users SET is_active = 0 WHERE email = ?')
      .run(VALID_USER.email);

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: VALID_USER.email,
        password: VALID_USER.password
      });

    expect(res.statusCode).toBe(403);
  });

  test('forgot password handles an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.com' });

    expect(res.statusCode).toBe(200);
  });

  test('forgot password handles a registered email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: VALID_USER.email });

    expect(res.statusCode).toBe(200);
  });

  test('reset password handles a registered user', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: VALID_USER.email,
        code: '123456',
        newPassword: 'NewPass@123'
      });

    expect(res.statusCode).toBe(200);
  });

  test('reset password handles an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: 'unknown@example.com',
        code: '123456',
        newPassword: 'NewPass@123'
      });

    expect(res.statusCode).toBe(404);
  });

});