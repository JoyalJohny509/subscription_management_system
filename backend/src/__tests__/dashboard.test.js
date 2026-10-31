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

describe('Dashboard API', () => {
    let adminToken;
    let staffToken;
    let customerToken;

    beforeAll(() => {
        adminToken = createToken(1, 'admin');
        staffToken = createToken(2, 'staff');
        customerToken = createToken(3, 'customer');

        db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (1, 'Admin', 'admin@test.com', 'hashed', 'admin')
    `).run();

        db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (2, 'Staff', 'staff@test.com', 'hashed', 'staff')
    `).run();

        db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (3, 'Customer', 'customer@test.com', 'hashed', 'customer')
    `).run();

        const customerId = db.prepare(`
      INSERT INTO customers (user_id, company_name)
      VALUES (3, 'Test Company')
    `).run().lastInsertRowid;

        const productId = db.prepare(`
      INSERT INTO products (name, type, sales_price, cost_price)
      VALUES ('Test Product', 'physical', 500, 200)
    `).run().lastInsertRowid;

        const planId = db.prepare(`
      INSERT INTO plans (name, product_id, billing_cycle, price)
      VALUES ('Monthly Plan', ?, 'monthly', 500)
    `).run(productId).lastInsertRowid;

        db.prepare(`
      INSERT INTO subscriptions
      (customer_id, plan_id, status, start_date, expiry_date, grand_total)
      VALUES (?, ?, 'active', '2026-01-01', '2026-12-31', 500)
    `).run(customerId, planId);

        db.prepare(`
      INSERT INTO subscriptions
      (customer_id, plan_id, status, start_date, expiry_date, grand_total)
      VALUES (?, ?, 'paused', '2026-01-01', '2026-12-31', 300)
    `).run(customerId, planId);

        const subscriptionId = db.prepare(`
  SELECT id FROM subscriptions LIMIT 1
`).get().id;

        db.prepare(`
  INSERT INTO invoices
  (invoice_number, subscription_id, customer_id, status, issue_date, due_date, grand_total)
  VALUES ('INV-TEST-001', ?, ?, 'confirmed', '2026-01-01', '2000-01-01', 500)
`).run(subscriptionId, customerId);

        db.prepare(`
  INSERT INTO invoices
  (invoice_number, subscription_id, customer_id, status, issue_date, due_date, grand_total)
  VALUES ('INV-TEST-002', ?, ?, 'confirmed', '2026-01-01', '2099-12-31', 300)
`).run(subscriptionId, customerId);

        db.prepare(`
      INSERT INTO payments
      (invoice_id, customer_id, amount, method, payment_date, status)
      VALUES (1, ?, 200, 'cash', '2026-10-01', 'completed')
    `).run(customerId);

        db.prepare(`
      INSERT INTO payments
      (invoice_id, customer_id, amount, method, payment_date, status)
      VALUES (1, ?, 100, 'cash', '2026-10-02', 'pending')
    `).run(customerId);
    });

    test('should reject requests without authentication', async () => {
        const res = await request(app).get('/api/dashboard/summary');
        expect(res.statusCode).toBe(401);
    });

    test('customer should not access dashboard', async () => {
        const res = await request(app)
            .get('/api/dashboard/summary')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.statusCode).toBe(403);
    });

    test('admin should get dashboard summary', async () => {
        const res = await request(app)
            .get('/api/dashboard/summary')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveProperty('active_subscriptions');
        expect(res.body.data).toHaveProperty('total_revenue');
        expect(res.body.data).toHaveProperty('outstanding');
        expect(res.body.data).toHaveProperty('overdue_invoices');
        expect(res.body.data).toHaveProperty('monthly_revenue');
        expect(res.body.data).toHaveProperty('recent_invoices');
        expect(res.body.data).toHaveProperty('subscription_status_breakdown');
    });

    test('dashboard summary should calculate revenue and active subscriptions', async () => {
        const res = await request(app)
            .get('/api/dashboard/summary')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.active_subscriptions).toBe(1);
        expect(res.body.data.total_revenue).toBe(200);
    });

    test('staff should get dashboard summary', async () => {
        const res = await request(app)
            .get('/api/dashboard/summary')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.statusCode).toBe(200);
    });

    test('should get revenue report', async () => {
        const res = await request(app)
            .get('/api/dashboard/reports/revenue')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0]).toHaveProperty('month');
        expect(res.body.data[0]).toHaveProperty('amount');
    });

    test('should filter revenue report by date range', async () => {
        const res = await request(app)
            .get('/api/dashboard/reports/revenue?from=2026-10-01&to=2026-10-01')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].amount).toBe(200);
    });

    test('should get subscription report', async () => {
        const res = await request(app)
            .get('/api/dashboard/reports/subscriptions')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(2);
        expect(res.body.data[0]).toHaveProperty('customer_name');
        expect(res.body.data[0]).toHaveProperty('plan_name');
    });

    test('should get overdue invoice report', async () => {
        const res = await request(app)
            .get('/api/dashboard/reports/overdue')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].invoice_number).toBe('INV-TEST-001');
    });

    test('staff should access all dashboard reports', async () => {
        const res = await request(app)
            .get('/api/dashboard/reports/subscriptions')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.statusCode).toBe(200);
    });

    test('customer should not access dashboard reports', async () => {
        const res = await request(app)
            .get('/api/dashboard/reports/revenue')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.statusCode).toBe(403);
    });
});