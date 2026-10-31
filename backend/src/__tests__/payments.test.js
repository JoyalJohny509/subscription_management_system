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

describe('Payments API', () => {
    let adminToken;
    let customerToken;
    let customer2Token;
    let customerId;
    let customer2Id;
    let invoiceId;
    let invoice2Id;
    let paymentId;

    beforeAll(() => {
        adminToken = createToken(3, 'admin');
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

        const planId = db.prepare(`
      INSERT INTO plans (name, product_id, billing_cycle, price)
      VALUES ('Monthly Plan', ?, 'monthly', 100)
    `).run(productId).lastInsertRowid;

        const subscriptionId = db.prepare(`
      INSERT INTO subscriptions (customer_id, plan_id, status)
      VALUES (?, ?, 'active')
    `).run(customerId, planId).lastInsertRowid;

        invoiceId = db.prepare(`
      INSERT INTO invoices
      (invoice_number, subscription_id, customer_id, status, grand_total)
      VALUES ('INV-PAY-001', ?, ?, 'confirmed', 500)
    `).run(subscriptionId, customerId).lastInsertRowid;

        invoice2Id = db.prepare(`
      INSERT INTO invoices
      (invoice_number, subscription_id, customer_id, status, grand_total)
      VALUES ('INV-PAY-002', ?, ?, 'confirmed', 300)
    `).run(subscriptionId, customer2Id).lastInsertRowid;
    });

    test('should reject requests without authentication', async () => {
        const res = await request(app).get('/api/payments');
        expect(res.statusCode).toBe(401);
    });

    test('admin should get all payments', async () => {
        const res = await request(app)
            .get('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
    });

    test('admin should create a payment', async () => {
        const res = await request(app)
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                invoice_id: invoiceId,
                amount: 200,
                method: 'cash',
                payment_date: '2026-10-31',
                notes: 'First payment'
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.amount).toBe(200);
        expect(res.body.data.method).toBe('cash');
        expect(res.body.data.status).toBe('completed');

        paymentId = res.body.data.id;
    });

    test('should reject payment creation without required fields', async () => {
        const res = await request(app)
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        expect(res.statusCode).toBe(400);
    });

    test('should return 404 for an unknown invoice', async () => {
        const res = await request(app)
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                invoice_id: 9999,
                amount: 100,
                method: 'cash'
            });

        expect(res.statusCode).toBe(404);
    });

    test('customer should not be allowed to create payments', async () => {
        const res = await request(app)
            .post('/api/payments')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                invoice_id: invoiceId,
                amount: 100,
                method: 'cash'
            });

        expect(res.statusCode).toBe(403);
    });

    test('should list payments for an invoice', async () => {
        const res = await request(app)
            .get(`/api/payments/invoice/${invoiceId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.total).toBe(res.body.data.length);
    });

    test('should return 404 when invoice does not exist', async () => {
        const res = await request(app)
            .get('/api/payments/invoice/9999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(404);
    });

    test('customer should not access another customer invoice payments', async () => {
        const res = await request(app)
            .get(`/api/payments/invoice/${invoice2Id}`)
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.statusCode).toBe(403);
    });

    test('customer should only see their own payments', async () => {
        const res = await request(app)
            .get('/api/payments')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.every(p => p.customer_id === customerId)).toBe(true);
    });

    test('should filter payments by status', async () => {
        const res = await request(app)
            .get('/api/payments?status=completed')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.every(p => p.status === 'completed')).toBe(true);
    });

    test('should get payment details', async () => {
        const res = await request(app)
            .get(`/api/payments/${paymentId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.id).toBe(paymentId);
    });

    test('should return 404 for an unknown payment', async () => {
        const res = await request(app)
            .get('/api/payments/9999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(404);
    });

    test('customer should not access another customer payment', async () => {
        const res = await request(app)
            .get(`/api/payments/${paymentId}`)
            .set('Authorization', `Bearer ${customer2Token}`);

        expect(res.statusCode).toBe(403);
    });

    test('admin should update payment notes and status', async () => {
        const res = await request(app)
            .put(`/api/payments/${paymentId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                notes: 'Payment verified',
                status: 'completed'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.notes).toBe('Payment verified');
        expect(res.body.data.status).toBe('completed');
    });

    test('should return 404 when updating an unknown payment', async () => {
        const res = await request(app)
            .put('/api/payments/9999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ notes: 'Updated' });

        expect(res.statusCode).toBe(404);
    });

    test('customer should not be allowed to update payments', async () => {
        const res = await request(app)
            .put(`/api/payments/${paymentId}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ notes: 'Not allowed' });

        expect(res.statusCode).toBe(403);
    });

    test('should mark invoice as paid when payment reaches grand total', async () => {
        const res = await request(app)
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                invoice_id: invoice2Id,
                amount: 300,
                method: 'bank_transfer'
            });

        expect(res.statusCode).toBe(201);

        const invoice = db.prepare(
            'SELECT status FROM invoices WHERE id = ?'
        ).get(invoice2Id);

        expect(invoice.status).toBe('paid');
    });
});