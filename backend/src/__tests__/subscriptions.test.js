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

describe('Subscriptions API', () => {
    let adminToken;
    let customerToken;
    let customer2Token;
    let customerId;
    let customer2Id;
    let planId;
    let subscriptionId;

    beforeAll(() => {
        adminToken = createToken(1, 'admin');
        customerToken = createToken(1, 'customer');
        customer2Token = createToken(2, 'customer');

        db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (1, 'Customer One', 'customer1@test.com', 'hashed', 'customer')
    `).run();

        db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (2, 'Customer Two', 'customer2@test.com', 'hashed', 'customer')
    `).run();

        db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (3, 'Admin User', 'admin@test.com', 'hashed', 'admin')
    `).run();

        customerId = db.prepare(`
      INSERT INTO customers (user_id, company_name)
      VALUES (1, 'Company One')
    `).run().lastInsertRowid;

        customer2Id = db.prepare(`
      INSERT INTO customers (user_id, company_name)
      VALUES (2, 'Company Two')
    `).run().lastInsertRowid;

        const productId = db.prepare(`
      INSERT INTO products (name, type, sales_price, cost_price)
      VALUES ('Test Product', 'physical', 100, 50)
    `).run().lastInsertRowid;

        planId = db.prepare(`
      INSERT INTO plans (name, product_id, billing_cycle, price, allow_pause)
      VALUES ('Monthly Plan', ?, 'monthly', 100, 1)
    `).run(productId).lastInsertRowid;

        subscriptionId = db.prepare(`
      INSERT INTO subscriptions
      (customer_id, plan_id, status, start_date, expiry_date)
      VALUES (?, ?, 'draft', '2026-01-01', '2026-12-31')
    `).run(customerId, planId).lastInsertRowid;
    });

    test('should reject requests without authentication', async () => {
        const res = await request(app).get('/api/subscriptions');
        expect(res.statusCode).toBe(401);
    });

    test('admin should get all subscriptions', async () => {
        const res = await request(app)
            .get('/api/subscriptions')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('customer should only see their subscriptions', async () => {
        const res = await request(app)
            .get('/api/subscriptions')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.every(s => s.customer_id === customerId)).toBe(true);
    });

    test('should filter subscriptions by status', async () => {
        const res = await request(app)
            .get('/api/subscriptions?status=draft')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.every(s => s.status === 'draft')).toBe(true);
    });

    test('admin should create a subscription', async () => {
        const res = await request(app)
            .post('/api/subscriptions')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                customer_id: customerId,
                plan_id: planId,
                start_date: '2026-01-01',
                expiry_date: '2026-12-31',
                lines: [
                    {
                        product_id: 1,
                        description: 'Test item',
                        qty: 2,
                        unit_price: 100,
                        tax_pct: 10
                    }
                ]
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.sub_number).toMatch(/^SUB-/);
        expect(res.body.data.subtotal).toBe(200);
        expect(res.body.data.tax_total).toBe(20);
        expect(res.body.data.grand_total).toBe(220);
    });

    test('should reject subscription creation without required fields', async () => {
        const res = await request(app)
            .post('/api/subscriptions')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        expect(res.statusCode).toBe(400);
    });

    test('should return 404 for an unknown customer', async () => {
        const res = await request(app)
            .post('/api/subscriptions')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ customer_id: 9999, plan_id: planId });

        expect(res.statusCode).toBe(404);
    });

    test('should return 404 for an unknown plan', async () => {
        const res = await request(app)
            .post('/api/subscriptions')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ customer_id: customerId, plan_id: 9999 });

        expect(res.statusCode).toBe(404);
    });

    test('customer should not be allowed to create subscriptions', async () => {
        const res = await request(app)
            .post('/api/subscriptions')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ customer_id: customerId, plan_id: planId });

        expect(res.statusCode).toBe(403);
    });

    test('should get subscription details with lines', async () => {
        const res = await request(app)
            .get(`/api/subscriptions/${subscriptionId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.id).toBe(subscriptionId);
        expect(res.body.data.lines).toBeDefined();
    });

    test('should return 404 for an unknown subscription', async () => {
        const res = await request(app)
            .get('/api/subscriptions/9999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(404);
    });

    test('customer should not access another customer subscription', async () => {
        const res = await request(app)
            .get(`/api/subscriptions/${subscriptionId}`)
            .set('Authorization', `Bearer ${customer2Token}`);

        expect(res.statusCode).toBe(403);
    });

    test('should update a draft subscription', async () => {
        const res = await request(app)
            .put(`/api/subscriptions/${subscriptionId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ notes: 'Updated subscription notes' });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.notes).toBe('Updated subscription notes');
    });

    test('should confirm a draft subscription', async () => {
        const res = await request(app)
            .post(`/api/subscriptions/${subscriptionId}/confirm`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('confirmed');
    });

    test('should activate a confirmed subscription', async () => {
        const res = await request(app)
            .post(`/api/subscriptions/${subscriptionId}/activate`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('active');
    });

    test('should pause an active subscription when plan allows it', async () => {
        const res = await request(app)
            .post(`/api/subscriptions/${subscriptionId}/pause`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('paused');
    });

    test('should close a paused subscription', async () => {
        const res = await request(app)
            .post(`/api/subscriptions/${subscriptionId}/close`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('closed');
    });

    test('should reject updating a closed subscription', async () => {
        const res = await request(app)
            .put(`/api/subscriptions/${subscriptionId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ notes: 'This should not update' });

        expect(res.statusCode).toBe(400);
    });
});