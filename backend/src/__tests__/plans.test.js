
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';

const app = require('../index');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'brightloop-secret-key-2024';

function createToken(id, role) {
    return jwt.sign(
        { id, name: `${role} User`, email: `${role}@test.com`, role },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

let productId;
let planId;

beforeAll(() => {
    const product = db.prepare(
        'INSERT INTO products (name, type) VALUES (?, ?)'
    ).run('Plans Test Product', 'Software');

    productId = product.lastInsertRowid;

    const plan = db.prepare(`
    INSERT INTO plans (name, product_id, billing_cycle, price)
    VALUES (?, ?, ?, ?)
  `).run('Monthly Test Plan', productId, 'monthly', 500);

    planId = plan.lastInsertRowid;
});

test('allows authenticated users to view plans', async () => {
    const response = await request(app)
        .get('/api/plans')
        .set('Authorization', `Bearer ${createToken(1, 'customer')}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.total).toBeGreaterThan(0);
});

test('filters plans by billing cycle', async () => {
    const response = await request(app)
        .get('/api/plans?billing_cycle=monthly')
        .set('Authorization', `Bearer ${createToken(1, 'customer')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.every(p => p.billing_cycle === 'monthly')).toBe(true);
});

test('allows users to view a single plan', async () => {
    const response = await request(app)
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${createToken(1, 'customer')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Monthly Test Plan');
});

test('returns 404 for a missing plan', async () => {
    const response = await request(app)
        .get('/api/plans/99999')
        .set('Authorization', `Bearer ${createToken(1, 'customer')}`);

    expect(response.status).toBe(404);
});

test('allows admin to create a plan', async () => {
    const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`)
        .send({
            name: 'Yearly Test Plan',
            product_id: productId,
            billing_cycle: 'yearly',
            price: 5000
        });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Yearly Test Plan');
});

test('prevents customers from creating plans', async () => {
    const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${createToken(2, 'customer')}`)
        .send({
            name: 'Customer Plan',
            product_id: productId,
            billing_cycle: 'monthly',
            price: 100
        });

    expect(response.status).toBe(403);
});

test('allows admin to update a plan', async () => {
    const response = await request(app)
        .put(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`)
        .send({ name: 'Updated Monthly Plan' });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Updated Monthly Plan');
});

test('allows admin to deactivate a plan', async () => {
    const response = await request(app)
        .delete(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`);

    expect(response.status).toBe(200);

    const savedPlan = db.prepare(
        'SELECT is_active FROM plans WHERE id = ?'
    ).get(planId);

    expect(savedPlan.is_active).toBe(0);
});

