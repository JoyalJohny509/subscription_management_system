const db = require('./database');
const { runMigrations } = require('./migrator');

function initializeDB() {
  // ── Users ──────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'customer'
                            CHECK(role IN ('admin','staff','customer')),
      is_active     INTEGER DEFAULT 1,
      created_at    TEXT    DEFAULT (datetime('now')),
      updated_at    TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── Customers ──────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      company_name TEXT,
      phone        TEXT,
      address      TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Staff ─────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      department TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Products ──────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      type        TEXT,
      sales_price REAL,
      cost_price  REAL,
      notes       TEXT,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── Product Variants ──────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id       INTEGER NOT NULL REFERENCES products(id),
      name             TEXT    NOT NULL,
      additional_price REAL    DEFAULT 0,
      is_active        INTEGER DEFAULT 1
    );
  `);

  // ── Plans ─────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT    NOT NULL,
      product_id         INTEGER NOT NULL REFERENCES products(id),
      billing_cycle      TEXT    CHECK(billing_cycle IN ('daily','weekly','monthly','yearly')),
      price              REAL,
      min_qty            INTEGER DEFAULT 1,
      start_date         TEXT,
      end_date           TEXT,
      auto_close         INTEGER DEFAULT 0,
      allow_pause        INTEGER DEFAULT 1,
      allow_early_close  INTEGER DEFAULT 1,
      allow_renewal      INTEGER DEFAULT 1,
      is_active          INTEGER DEFAULT 1,
      created_at         TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── Quotations ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotations (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT    UNIQUE,
      customer_id      INTEGER NOT NULL REFERENCES customers(id),
      validity_days    INTEGER DEFAULT 30,
      status           TEXT    DEFAULT 'draft'
                               CHECK(status IN ('draft','sent','accepted','rejected')),
      notes            TEXT,
      subtotal         REAL    DEFAULT 0,
      tax_total        REAL    DEFAULT 0,
      discount_total   REAL    DEFAULT 0,
      grand_total      REAL    DEFAULT 0,
      created_at       TEXT    DEFAULT (datetime('now')),
      updated_at       TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── Quotation Lines ───────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotation_lines (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id),
      product_id   INTEGER NOT NULL REFERENCES products(id),
      plan_id      INTEGER REFERENCES plans(id),
      variant_id   INTEGER REFERENCES product_variants(id),
      qty          INTEGER DEFAULT 1,
      unit_price   REAL,
      tax_pct      REAL    DEFAULT 0,
      line_total   REAL
    );
  `);

  // ── Subscriptions ─────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sub_number     TEXT    UNIQUE,
      customer_id    INTEGER NOT NULL REFERENCES customers(id),
      plan_id        INTEGER NOT NULL REFERENCES plans(id),
      quotation_id   INTEGER REFERENCES quotations(id),
      status         TEXT    DEFAULT 'draft'
                             CHECK(status IN ('draft','quotation','confirmed','active','paused','closed')),
      start_date     TEXT,
      expiry_date    TEXT,
      payment_terms  TEXT    DEFAULT 'immediate',
      notes          TEXT,
      subtotal       REAL    DEFAULT 0,
      tax_total      REAL    DEFAULT 0,
      discount_total REAL    DEFAULT 0,
      grand_total    REAL    DEFAULT 0,
      created_at     TEXT    DEFAULT (datetime('now')),
      updated_at     TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── Subscription Lines ────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_lines (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
      product_id      INTEGER NOT NULL REFERENCES products(id),
      variant_id      INTEGER REFERENCES product_variants(id),
      description     TEXT,
      qty             INTEGER DEFAULT 1,
      unit_price      REAL,
      tax_pct         REAL    DEFAULT 0,
      line_total      REAL
    );
  `);

  // ── Invoices ──────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number       TEXT    UNIQUE,
      subscription_id      INTEGER NOT NULL REFERENCES subscriptions(id),
      customer_id          INTEGER NOT NULL REFERENCES customers(id),
      status               TEXT    DEFAULT 'draft'
                                   CHECK(status IN ('draft','confirmed','paid','cancelled')),
      issue_date           TEXT,
      due_date             TEXT,
      billing_period_start TEXT,
      billing_period_end   TEXT,
      subtotal             REAL    DEFAULT 0,
      tax_total            REAL    DEFAULT 0,
      discount_total       REAL    DEFAULT 0,
      grand_total          REAL    DEFAULT 0,
      notes                TEXT,
      created_at           TEXT    DEFAULT (datetime('now')),
      updated_at           TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── Invoice Lines ─────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_lines (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      product_id INTEGER REFERENCES products(id),
      description TEXT,
      qty        INTEGER DEFAULT 1,
      unit_price REAL,
      tax_pct    REAL    DEFAULT 0,
      line_total REAL
    );
  `);

  // ── Discounts ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS discounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT    UNIQUE,
      name          TEXT,
      type          TEXT    CHECK(type IN ('fixed','percentage')),
      value         REAL,
      min_amount    REAL    DEFAULT 0,
      min_qty       INTEGER DEFAULT 1,
      start_date    TEXT,
      end_date      TEXT,
      max_uses      INTEGER DEFAULT NULL,
      uses_count    INTEGER DEFAULT 0,
      applicable_to TEXT    DEFAULT 'all'
                            CHECK(applicable_to IN ('all','product','subscription')),
      is_active     INTEGER DEFAULT 1,
      created_at    TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── Payments ──────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id   INTEGER NOT NULL REFERENCES invoices(id),
      customer_id  INTEGER NOT NULL REFERENCES customers(id),
      amount       REAL,
      method       TEXT    CHECK(method IN ('cash','upi','bank_transfer','card','cheque')),
      payment_date TEXT,
      notes        TEXT,
      status       TEXT    DEFAULT 'completed'
                           CHECK(status IN ('pending','completed','failed')),
      created_at   TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── Taxes ─────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS taxes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT,
      rate_pct   REAL,
      is_default INTEGER DEFAULT 0,
      is_active  INTEGER DEFAULT 1
    );
  `);

  // ── Indexes ───────────────────────────────────────────────────────────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email);
    CREATE INDEX IF NOT EXISTS idx_customers_user_id
      ON customers(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id
      ON subscriptions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status
      ON subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id
      ON invoices(subscription_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status
      ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice_id
      ON payments(invoice_id);
  `);

  console.log('✅ Database schema initialized');
  runMigrations();
}

module.exports = { initializeDB };
