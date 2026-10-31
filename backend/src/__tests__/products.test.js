const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';

const app = require('../index');

const JWT_SECRET = process.env.JWT_SECRET || 'brightloop-secret-key-2024';

function createToken(id, role) {
    return jwt.sign(
        { id, name: `${role} User`, email: `${role}@test.com`, role },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

test('allows an authenticated user to view products', async () => {
    const token = createToken(1, 'customer');

    const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total');
    expect(Array.isArray(response.body.data)).toBe(true);
});
test('returns 401 when viewing products without a token', async () => {
    const response = await request(app).get('/api/products');

    expect(response.status).toBe(401);
});
const db = require('../db/database');

test('allows an admin to create a product', async () => {
    const token = createToken(1, 'admin');

    const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
            name: 'Test Product',
            type: 'Software',
            sales_price: 1000,
            cost_price: 500,
            notes: 'Product created for testing'
        });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Test Product');
});
test('prevents a customer from creating a product', async () => {
    const token = createToken(2, 'customer');

    const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
            name: 'Customer Product',
            type: 'Software'
        });

    expect(response.status).toBe(403);
});
test('prevents product creation without a token', async () => {
    const response = await request(app)
        .post('/api/products')
        .send({ name: 'Unauthorized Product' });

    expect(response.status).toBe(401);
});
test('allows an authenticated user to view a single product', async () => {
    const token = createToken(1, 'customer');

    const product = db.prepare(`
    INSERT INTO products (name, type, sales_price, cost_price, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run('View Test Product', 'Software', 1000, 500, 'Test product');

    const response = await request(app)
        .get(`/api/products/${product.lastInsertRowid}`)
        .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('View Test Product');
});
test('returns 404 when a product does not exist', async () => {
    const token = createToken(1, 'customer');

    const response = await request(app)
        .get('/api/products/99999')
        .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
});
test('allows an admin to update a product', async () => {
    const token = createToken(1, 'admin');

    const product = db.prepare(`
    INSERT INTO products (name, type)
    VALUES (?, ?)
  `).run('Old Product', 'Software');

    const response = await request(app)
        .put(`/api/products/${product.lastInsertRowid}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Product' });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Updated Product');
});
test('prevents a customer from updating a product', async () => {
    const token = createToken(2, 'customer');

    const product = db.prepare(
        'INSERT INTO products (name) VALUES (?)'
    ).run('Customer Update Test');

    const response = await request(app)
        .put(`/api/products/${product.lastInsertRowid}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Changed Product' });

    expect(response.status).toBe(403);
});

test('returns 404 when updating a missing product', async () => {
    const token = createToken(1, 'admin');

    const response = await request(app)
        .put('/api/products/99999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Missing Product' });

    expect(response.status).toBe(404);
});

test('allows an admin to deactivate a product', async () => {
    const token = createToken(1, 'admin');

    const product = db.prepare(
        'INSERT INTO products (name) VALUES (?)'
    ).run('Delete Test Product');

    const response = await request(app)
        .delete(`/api/products/${product.lastInsertRowid}`)
        .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    const savedProduct = db.prepare(
        'SELECT is_active FROM products WHERE id = ?'
    ).get(product.lastInsertRowid);

    expect(savedProduct.is_active).toBe(0);
});

test('returns 404 when deleting a missing product', async () => {
    const token = createToken(1, 'admin');

    const response = await request(app)
        .delete('/api/products/99999')
        .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
});