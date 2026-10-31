const express = require('express');
const cors = require('cors');

const { initializeDB } = require('./db/schema');

const authRoutes         = require('./routes/auth');
const usersRoutes        = require('./routes/users');
const productsRoutes     = require('./routes/products');
const plansRoutes        = require('./routes/plans');
const quotationsRoutes   = require('./routes/quotations');
const subscriptionsRoutes = require('./routes/subscriptions');
const invoicesRoutes     = require('./routes/invoices');
const discountsRoutes    = require('./routes/discounts');
const paymentsRoutes     = require('./routes/payments');
const dashboardRoutes    = require('./routes/dashboard');

// ── Initialize DB ──────────────────────────────────────────────────────────────
initializeDB();

const app = express();
const PORT = process.env.PORT || 5001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/products',      productsRoutes);
app.use('/api/plans',         plansRoutes);
app.use('/api/quotations',    quotationsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/invoices',      invoicesRoutes);
app.use('/api/discounts',     discountsRoutes);
app.use('/api/payments',      paymentsRoutes);
app.use('/api/dashboard',     dashboardRoutes);

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Brightloop SMS API is running', timestamp: new Date().toISOString() });
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Brightloop SMS API running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
