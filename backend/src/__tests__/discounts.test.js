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

describe('Discounts API', () => {
    let adminToken;
    let staffToken;
    let customerToken;
    let discountId;

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

        discountId = db.prepare(`
      INSERT INTO discounts
      (code, name, type, value, min_amount, min_qty, max_uses, uses_count, is_active)
      VALUES ('SAVE10', 'Ten Percent Off', 'percentage', 10, 100, 1, 10, 0, 1)
    `).run().lastInsertRowid;

        db.prepare(`
      INSERT INTO discounts
      (code, name, type, value, min_amount, min_qty, is_active)
      VALUES ('FIXED50', 'Fixed Discount', 'fixed', 50, 0, 1, 1)
    `).run();

        db.prepare(`
      INSERT INTO discounts
      (code, name, type, value, min_amount, min_qty, is_active)
      VALUES ('INACTIVE', 'Inactive Discount', 'percentage', 20, 0, 1, 0)
    `).run();

        db.prepare(`
      INSERT INTO discounts
      (code, name, type, value, min_amount, min_qty, start_date, is_active)
      VALUES ('FUTURE', 'Future Discount', 'percentage', 10, 0, 1, '2099-01-01', 1)
    `).run();

        db.prepare(`
      INSERT INTO discounts
      (code, name, type, value, min_amount, min_qty, end_date, is_active)
      VALUES ('EXPIRED', 'Expired Discount', 'percentage', 10, 0, 1, '2000-01-01', 1)
    `).run();

        db.prepare(`
      INSERT INTO discounts
      (code, name, type, value, min_amount, min_qty, max_uses, uses_count, is_active)
      VALUES ('USEDUP', 'Used Up Discount', 'fixed', 20, 0, 1, 1, 1, 1)
    `).run();
    });

    test('should reject requests without authentication', async () => {
        const res = await request(app).get('/api/discounts');
        expect(res.statusCode).toBe(401);
    });

    test('admin should get all discounts', async () => {
        const res = await request(app)
            .get('/api/discounts')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('staff should get all discounts', async () => {
        const res = await request(app)
            .get('/api/discounts')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.statusCode).toBe(200);
    });

    test('customer should not get the discounts list', async () => {
        const res = await request(app)
            .get('/api/discounts')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.statusCode).toBe(403);
    });

    test('admin should create a discount', async () => {
        const res = await request(app)
            .post('/api/discounts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                code: 'NEW20',
                name: 'Twenty Percent Off',
                type: 'percentage',
                value: 20
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.code).toBe('NEW20');
        expect(res.body.data.value).toBe(20);
    });

    test('should reject discount creation without required fields', async () => {
        const res = await request(app)
            .post('/api/discounts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Missing Fields' });

        expect(res.statusCode).toBe(400);
    });

    test('should reject duplicate discount codes', async () => {
        const res = await request(app)
            .post('/api/discounts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                code: 'SAVE10',
                type: 'percentage',
                value: 10
            });

        expect(res.statusCode).toBe(409);
    });

    test('staff should not create discounts', async () => {
        const res = await request(app)
            .post('/api/discounts')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({
                code: 'STAFF10',
                type: 'percentage',
                value: 10
            });

        expect(res.statusCode).toBe(403);
    });

    test('should get discount details', async () => {
        const res = await request(app)
            .get(`/api/discounts/${discountId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.code).toBe('SAVE10');
    });

    test('should return 404 for an unknown discount', async () => {
        const res = await request(app)
            .get('/api/discounts/9999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(404);
    });

    test('admin should update a discount', async () => {
        const res = await request(app)
            .put(`/api/discounts/${discountId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Updated Discount',
                value: 15
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.name).toBe('Updated Discount');
        expect(res.body.data.value).toBe(15);
    });

    test('staff should not update discounts', async () => {
        const res = await request(app)
            .put(`/api/discounts/${discountId}`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ name: 'Staff Update' });

        expect(res.statusCode).toBe(403);
    });

    test('should return 404 when updating an unknown discount', async () => {
        const res = await request(app)
            .put('/api/discounts/9999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Unknown' });

        expect(res.statusCode).toBe(404);
    });

    test('should validate a percentage discount', async () => {
        const res = await request(app)
            .post('/api/discounts/validate')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ code: 'SAVE10', amount: 200, qty: 2 });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.computed_discount).toBe(30);
    });

    test('should calculate a fixed discount', async () => {
        const res = await request(app)
            .post('/api/discounts/validate')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ code: 'FIXED50', amount: 200 });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.computed_discount).toBe(50);
    });

    test('should reject validation without a code', async () => {
        const res = await request(app)
            .post('/api/discounts/validate')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ amount: 200 });

        expect(res.statusCode).toBe(400);
    });

    test('should reject an inactive or unknown discount', async () => {
        const res = await request(app)
            .post('/api/discounts/validate')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ code: 'INACTIVE', amount: 200 });

        expect(res.statusCode).toBe(404);
    });

    test('should reject a discount before its start date', async () => {
        const res = await request(app)
            .post('/api/discounts/validate')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ code: 'FUTURE', amount: 200 });

        expect(res.statusCode).toBe(400);
    });

    test('should reject an expired discount', async () => {
        const res = await request(app)
            .post('/api/discounts/validate')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ code: 'EXPIRED', amount: 200 });

        expect(res.statusCode).toBe(400);
    });

    test('should reject a discount when usage limit is reached', async () => {
        const res = await request(app)
            .post('/api/discounts/validate')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ code: 'USEDUP', amount: 200 });

        expect(res.statusCode).toBe(400);
    });

    test('should reject an amount below the minimum', async () => {
        const res = await request(app)
            .post('/api/discounts/validate')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ code: 'SAVE10', amount: 50 });

        expect(res.statusCode).toBe(400);
    });

    test('should reject a quantity below the minimum', async () => {
        db.prepare(`
      UPDATE discounts SET min_qty = 5 WHERE code = 'SAVE10'
    `).run();

        const res = await request(app)
            .post('/api/discounts/validate')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ code: 'SAVE10', amount: 200, qty: 2 });

        expect(res.statusCode).toBe(400);
    });

    test('admin should delete a discount', async () => {
        const res = await request(app)
            .delete(`/api/discounts/${discountId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Discount deleted');
    });

    test('should return 404 when deleting an unknown discount', async () => {
        const res = await request(app)
            .delete('/api/discounts/9999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(404);
    });

    test('staff should not delete discounts', async () => {
        const res = await request(app)
            .delete('/api/discounts/2')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.statusCode).toBe(403);
    });
});