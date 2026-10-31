const bcrypt = require('bcryptjs');
const db = require('./database');
const { initializeDB } = require('./schema');

initializeDB();

// ── Helper ────────────────────────────────────────────────────────────────────
const run = (sql, params = []) => db.prepare(sql).run(...params);
const get = (sql, params = []) => db.prepare(sql).get(...params);

// ── Users ─────────────────────────────────────────────────────────────────────
const adminHash  = bcrypt.hashSync('Admin@1234', 10);
const staffHash  = bcrypt.hashSync('Staff@1234', 10);
const customerHash = bcrypt.hashSync('Customer@1234', 10);

run(
  `INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
  ['Admin User', 'admin@brightloop.com', adminHash, 'admin']
);
run(
  `INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
  ['Sales Staff', 'staff@brightloop.com', staffHash, 'staff']
);
run(
  `INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
  ['Ravi Kumar', 'ravi@acmecorp.com', customerHash, 'customer']
);

const adminUser    = get(`SELECT id FROM users WHERE email = ?`, ['admin@brightloop.com']);
const staffUser    = get(`SELECT id FROM users WHERE email = ?`, ['staff@brightloop.com']);
const customerUser = get(`SELECT id FROM users WHERE email = ?`, ['ravi@acmecorp.com']);

// ── Customers ─────────────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO customers (user_id, company_name, phone) VALUES (?, ?, ?)`,
  [customerUser.id, 'Acme Corp', '9876543210']
);

// ── Staff ─────────────────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO staff (user_id, department) VALUES (?, ?)`,
  [staffUser.id, 'Sales']
);

// ── Products ──────────────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO products (id, name, type, sales_price, cost_price) VALUES (?, ?, ?, ?, ?)`,
  [1, 'Business Software Suite', 'software', 1000, 600]
);
run(
  `INSERT OR IGNORE INTO products (id, name, type, sales_price, cost_price) VALUES (?, ?, ?, ?, ?)`,
  [2, 'Cloud Storage Add-on', 'addon', 500, 200]
);

// ── Product Variants ──────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO product_variants (id, product_id, name, additional_price) VALUES (?, ?, ?, ?)`,
  [1, 1, 'Standard', 0]
);
run(
  `INSERT OR IGNORE INTO product_variants (id, product_id, name, additional_price) VALUES (?, ?, ?, ?)`,
  [2, 1, 'Odoo Edition', 560]
);

// ── Plans ─────────────────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO plans (id, name, product_id, billing_cycle, price) VALUES (?, ?, ?, ?, ?)`,
  [1, 'Monthly Business Plan', 1, 'monthly', 1000]
);
run(
  `INSERT OR IGNORE INTO plans (id, name, product_id, billing_cycle, price) VALUES (?, ?, ?, ?, ?)`,
  [2, 'Yearly Business Plan', 1, 'yearly', 10000]
);

// ── Taxes ─────────────────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO taxes (id, name, rate_pct, is_default) VALUES (?, ?, ?, ?)`,
  [1, 'GST 18%', 18, 1]
);

// ── Discounts ─────────────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO discounts (id, code, name, type, value, min_amount, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [1, 'WELCOME10', 'Welcome 10% Off', 'percentage', 10, 5000, 100]
);

// ── Subscription ──────────────────────────────────────────────────────────────
const customer = get(`SELECT id FROM customers WHERE user_id = ?`, [customerUser.id]);

run(
  `INSERT OR IGNORE INTO subscriptions
     (id, sub_number, customer_id, plan_id, status, start_date, expiry_date, grand_total)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [1, 'SUB-0001', customer.id, 1, 'active', '2026-01-01', '2026-12-31', 5900]
);

// ── Subscription Lines ────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO subscription_lines
     (id, subscription_id, product_id, qty, unit_price, tax_pct, line_total)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [1, 1, 1, 5, 1000, 18, 5900]
);

// ── Invoices ──────────────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO invoices
     (id, invoice_number, subscription_id, customer_id, status, issue_date, due_date, grand_total)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [1, 'INV-0001', 1, customer.id, 'paid', '2026-01-01', '2026-01-15', 5900]
);
run(
  `INSERT OR IGNORE INTO invoices
     (id, invoice_number, subscription_id, customer_id, status, issue_date, due_date, grand_total)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [2, 'INV-0002', 1, customer.id, 'confirmed', '2026-02-01', '2026-02-15', 5900]
);

// ── Payments ──────────────────────────────────────────────────────────────────
run(
  `INSERT OR IGNORE INTO payments
     (id, invoice_id, customer_id, amount, method, payment_date, status)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [1, 1, customer.id, 5900, 'upi', '2026-01-10', 'completed']
);

console.log('✅ Database seeded successfully!');
