
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';

const app = require('../index');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'brightloop-secret-key-2024';

// Helper to create login tokens for different roles
function createToken(id, role) {
    return jwt.sign(
        { id, name: `${role} User`, email: `${role}@test.com`, role },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

describe('Users API - Authentication', () => {
    test('returns 401 when no token is provided', async () => {
        const response = await request(app)
            .get('/api/users');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('No token provided');
    });

    test('returns 401 when an invalid token is provided', async () => {
        const response = await request(app)
            .get('/api/users')
            .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid or expired token');
    });
});

describe('Users API - Role Permissions', () => {
    test('returns 403 when a customer tries to view all users', async () => {
        const customerToken = createToken(1, 'customer');

        const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe(
            'Forbidden: insufficient permissions'
        );
    });
});


test('allows admin to view all users', async () => {
    const adminToken = createToken(1, 'admin');

    const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total');
    expect(Array.isArray(response.body.data)).toBe(true);
});
test('returns 404 when the user profile does not exist', async () => {
    const token = createToken(9999, 'customer');

    const response = await request(app)
        .get('/api/users/profile/me')
        .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found');
});
test('rejects staff creation when required fields are missing', async () => {
    const adminToken = createToken(1, 'admin');

    const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Staff' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
        'name, email, and password are required'
    );
});
test('rejects staff creation when email already exists', async () => {
    const bcrypt = require('bcryptjs');
    const db = require('../db/database');
    const adminToken = createToken(1, 'admin');

    const passwordHash = bcrypt.hashSync('Strong@123', 10);

    db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('Admin User', 'admin@test.com', passwordHash, 'admin');

    const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            name: 'Duplicate Staff',
            email: 'admin@test.com',
            password: 'Strong@123'
        });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Email already in use');
});
test('returns 404 when the requested user does not exist', async () => {
    const adminToken = createToken(1, 'admin');

    const response = await request(app)
        .get('/api/users/99999')
        .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found');
});
test('returns 404 when trying to update a non-existent user', async () => {
    const adminToken = createToken(1, 'admin');

    const response = await request(app)
        .put('/api/users/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated User' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found');
});
test('returns 404 when trying to deactivate a non-existent user', async () => {
    const adminToken = createToken(1, 'admin');

    const response = await request(app)
        .delete('/api/users/99999')
        .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found');
});
test('allows admin to create a staff account', async () => {
    const adminToken = createToken(1, 'admin');

    const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            name: 'New Staff',
            email: 'newstaff@test.com',
            password: 'Strong@123',
            department: 'Support'
        });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('newstaff@test.com');
    expect(response.body.data.role).toBe('staff');
});
test('allows admin to update an existing user', async () => {
    const db = require('../db/database');
    const adminToken = createToken(1, 'admin');

    const passwordHash = require('bcryptjs').hashSync('Strong@123', 10);

    const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('Old Name', 'update@test.com', passwordHash, 'staff');

    const response = await request(app)
        .put(`/api/users/${result.lastInsertRowid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Updated Name');
});
test('allows admin to deactivate an existing user', async () => {
    const db = require('../db/database');
    const adminToken = createToken(1, 'admin');

    const passwordHash = require('bcryptjs').hashSync('Strong@123', 10);

    const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('Deactivate User', 'deactivate@test.com', passwordHash, 'staff');

    const response = await request(app)
        .delete(`/api/users/${result.lastInsertRowid}`)
        .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('User deactivated');

    const user = db.prepare('SELECT is_active FROM users WHERE id = ?')
        .get(result.lastInsertRowid);

    expect(user.is_active).toBe(0);
});