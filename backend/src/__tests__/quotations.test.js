
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

let customerId;
let productId;
let planId;
let quotationId;

beforeAll(() => {
    const user = db.prepare(`
  INSERT INTO users (name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
`).run('Quotation Customer', 'quotation@test.com', 'hashedpassword', 'customer');

    const customer = db.prepare(`
    INSERT INTO customers (user_id, company_name)
    VALUES (?, ?)
  `).run(user.lastInsertRowid, 'Quotation Test Company');

    customerId = customer.lastInsertRowid;

    const product = db.prepare(
        'INSERT INTO products (name) VALUES (?)'
    ).run('Quotation Test Product');

    productId = product.lastInsertRowid;

    const plan = db.prepare(`
    INSERT INTO plans (name, product_id, billing_cycle, price)
    VALUES (?, ?, ?, ?)
  `).run('Quotation Test Plan', productId, 'monthly', 500);

    planId = plan.lastInsertRowid;

    const quotation = db.prepare(`
    INSERT INTO quotations
    (customer_id, validity_days, subtotal, tax_total, grand_total)
    VALUES (?, ?, ?, ?, ?)
  `).run(customerId, 30, 1000, 180, 1180);

    quotationId = quotation.lastInsertRowid;
});

test('allows authenticated users to view quotations', async () => {
    const response = await request(app)
        .get('/api/quotations')
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
});

test('allows admin to create a quotation', async () => {
    const response = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`)
        .send({
            customer_id: customerId,
            validity_days: 30,
            lines: [{
                product_id: productId,
                plan_id: planId,
                qty: 2,
                unit_price: 500,
                tax_pct: 10
            }]
        });

    expect(response.status).toBe(201);
    expect(response.body.data.grand_total).toBe(1100);
});

test('rejects quotation creation without customer_id', async () => {
    const response = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`)
        .send({ notes: 'Missing customer' });

    expect(response.status).toBe(400);
});

test('returns 404 for an unknown customer', async () => {
    const response = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`)
        .send({ customer_id: 99999 });

    expect(response.status).toBe(404);
});

test('allows users to view a quotation', async () => {
    const response = await request(app)
        .get(`/api/quotations/${quotationId}`)
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(quotationId);
});

test('returns 404 for a missing quotation', async () => {
    const response = await request(app)
        .get('/api/quotations/99999')
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`);

    expect(response.status).toBe(404);
});

test('allows admin to update a draft quotation', async () => {
    const response = await request(app)
        .put(`/api/quotations/${quotationId}`)
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`)
        .send({ notes: 'Updated quotation notes' });

    expect(response.status).toBe(200);
    expect(response.body.data.notes).toBe('Updated quotation notes');
});

test('allows admin to send a draft quotation', async () => {
    const response = await request(app)
        .post(`/api/quotations/${quotationId}/send`)
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('sent');
});

test('allows admin to reject a quotation', async () => {
    const response = await request(app)
        .post(`/api/quotations/${quotationId}/reject`)
        .set('Authorization', `Bearer ${createToken(1, 'admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('rejected');
});

test('prevents customers from creating quotations', async () => {
    const response = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${createToken(2, 'customer')}`)
        .send({ customer_id: customerId });

    expect(response.status).toBe(403);
});
