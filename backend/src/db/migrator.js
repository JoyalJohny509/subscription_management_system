const fs = require('fs');
const path = require('path');
const db = require('./database');

function initMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    UNIQUE NOT NULL,
      applied_at TEXT    DEFAULT (datetime('now'))
    );
  `);
}

function checkReferentialIntegrity() {
  const violations = db.prepare('PRAGMA foreign_key_check').all();
  if (violations && violations.length > 0) {
    console.error('⚠️ Foreign key integrity violation(s) detected:', violations);
    throw new Error(`Referential integrity failure: ${violations.length} foreign key violation(s) found.`);
  }
  return true;
}

function runMigrations() {
  initMigrationsTable();

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[Migrator] No migrations directory found.');
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const appliedMigrations = [];

  for (const file of files) {
    const existing = db.prepare('SELECT id FROM _migrations WHERE name = ?').get(file);
    if (!existing) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`[Migrator] Applying migration: ${file}...`);
      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
      })();

      appliedMigrations.push(file);
      console.log(`[Migrator] ✅ Applied: ${file}`);
    }
  }

  // Ensure foreign key integrity across the whole database
  checkReferentialIntegrity();

  return appliedMigrations;
}

if (require.main === module) {
  try {
    const applied = runMigrations();
    console.log(`[Migrator] Migration process finished. ${applied.length} new migration(s) applied.`);
  } catch (err) {
    console.error('[Migrator] Migration error:', err.message);
    process.exit(1);
  }
}

module.exports = {
  runMigrations,
  checkReferentialIntegrity
};
