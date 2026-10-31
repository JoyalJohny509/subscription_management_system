const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'brightloop-secret-key-2024';

/**
 * Middleware to authenticate requests via Bearer JWT token.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Generate a JWT for the given user object.
 * @param {Object} user - user record from DB
 * @returns {string} signed JWT
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { authenticate, generateToken };
