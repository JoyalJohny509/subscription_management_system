
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

let adminToken;
let customerToken;
let customerId;
let productId;
let planId;
let subscriptionId;
let invoiceId;

function createInvoice(status = 'draft') {
    return db.prepare(`
    INSERT INTO invoices
    (subscription_id, customer_id, status, subtotal, grand_total)
    VALUES (?, ?, ?, ?, ?)
  `).run(subscriptionId, customerId, status, 1000, 1180).lastInsertRowid;
}

beforeAll(() => {
    adminToken = createToken(1, 'admin');

    const user = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('Invoice Customer', 'invoice@test.com', 'hashedpassword', 'customer');

    customerToken = createToken(user.lastInsertRowid, 'customer');

    const customer = db.prepare(`
    INSERT INTO customers (user_id, company_name)
    VALUES (?, ?)
  `).run(user.lastInsertRowid, 'Invoice Test Company');

    customerId = customer.lastInsertRowid;

    productId = db.prepare(
        'INSERT INTO products (name) VALUES (?)'
    ).run('Invoice Test Product').lastInsertRowid;

    planId = db.prepare(`
    INSERT INTO plans (name, product_id, billing_cycle, price)
    VALUES (?, ?, ?, ?)
  `).run('Invoice Test Plan', productId, 'monthly', 1000).lastInsertRowid;

    subscriptionId = db.prepare(`
    INSERT INTO subscriptions
    (customer_id, plan_id, status, subtotal, grand_total)
    VALUES (?, ?, ?, ?, ?)
  `).run(customerId, planId, 'active', 1000, 1180).lastInsertRowid;

    invoiceId = createInvoice();
});

describe('Invoices API', () => {
    test('should reject requests without a token', async () => {
        const res = await request(app).get('/api/invoices');
        expect(res.statusCode).toBe(401);
    });

    test('admin should get all invoices', async () => {
        const res = await request(app)
            .get('/api/invoices')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    test('customer should get only their invoices', async () => {
        const res = await request(app)
            .get('/api/invoices')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.every(
            invoice => invoice.customer_id === customerId
        )).toBe(true);
    });

    test('should filter invoices by status', async () => {
        const res = await request(app)
            .get('/api/invoices?status=draft')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.every(
            invoice => invoice.status === 'draft'
        )).toBe(true);
    });

    test('admin should create an invoice', async () => {
        const res = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                subscription_id: subscriptionId,
                customer_id: customerId,
                lines: [
                    {
                        product_id: productId,
                        description: 'Monthly service',
                        qty: 2,
                        unit_price: 500,
                        tax_pct: 10
                    }
                ]
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.invoice_number).toMatch(/^INV-/);
        expect(res.body.data.subtotal).toBe(1000);
        expect(res.body.data.tax_total).toBe(100);
        expect(res.body.data.grand_total).toBe(1100);
    });

    test('should reject invoice creation without required fields', async () => {
        const res = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        expect(res.statusCode).toBe(400);
    });

    test('customer should not create an invoice', async () => {
        const res = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                subscription_id: subscriptionId,
                customer_id: customerId
            });

        expect(res.statusCode).toBe(403);
    });

    test('should get a single invoice with its lines', async () => {
        const res = await request(app)
            .get(`/api/invoices/${invoiceId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.id).toBe(invoiceId);
        expect(Array.isArray(res.body.data.lines)).toBe(true);
    });

    test('should return 404 for a missing invoice', async () => {
        const res = await request(app)
            .get('/api/invoices/99999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(404);
    });

    test('should confirm a draft invoice', async () => {
        const id = createInvoice();

        const res = await request(app)
            .post(`/api/invoices/${id}/confirm`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('confirmed');
    });

    test('should not confirm an already confirmed invoice', async () => {
        const id = createInvoice('confirmed');

        const res = await request(app)
            .post(`/api/invoices/${id}/confirm`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(400);
    });

    test('should cancel an invoice', async () => {
        const id = createInvoice();

        const res = await request(app)
            .post(`/api/invoices/${id}/cancel`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('cancelled');
    });
});
// ─────────────────────────────────────────────────────────────
// Extra tests — invoice generation, printing and discounts
// ─────────────────────────────────────────────────────────────

describe('Extra Invoices API tests', () => {

    test('should return 404 when generating invoice for missing subscription', async () => {
        const res = await request(app)
            .post('/api/invoices/generate/99999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        expect(res.statusCode).toBe(404);
    });

    test('should generate invoice from active subscription', async () => {
        const res = await request(app)
            .post(`/api/invoices/generate/${subscriptionId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                billing_period_start: '2026-10-01',
                billing_period_end: '2026-10-31',
                issue_date: '2026-10-01',
                due_date: '2026-10-15'
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.invoice_number).toMatch(/^INV-/);
    });

    test('should reject duplicate billing period', async () => {
        const period = {
            billing_period_start: '2026-11-01',
            billing_period_end: '2026-11-30'
        };

        await request(app)
            .post(`/api/invoices/generate/${subscriptionId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(period);

        const res = await request(app)
            .post(`/api/invoices/generate/${subscriptionId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(period);

        expect(res.statusCode).toBe(409);
    });

    test('should return print data for an invoice', async () => {
        const res = await request(app)
            .get(`/api/invoices/${invoiceId}/print`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Print data ready');
        expect(res.body.data).toHaveProperty('plan_name');
    });

    test('should return 404 when printing missing invoice', async () => {
        const res = await request(app)
            .get('/api/invoices/99999/print')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(404);
    });

    test('should reject applying discount without code', async () => {
        const res = await request(app)
            .post(`/api/invoices/${invoiceId}/apply-discount`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        expect(res.statusCode).toBe(400);
    });

    test('should return 404 when applying discount to missing invoice', async () => {
        const res = await request(app)
            .post('/api/invoices/99999/apply-discount')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ code: 'SAVE10' });

        expect(res.statusCode).toBe(404);
    });

});