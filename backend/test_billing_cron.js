const assert = require('assert');
const { initializeDB } = require('./src/db/schema');
initializeDB();

const {
  addDays,
  addCycle,
  calculateDueDate,
  runBillingJob,
  runAutoClose,
  runAutoBilling
} = require('./src/jobs/billingCron');
const db = require('./src/db/database');

console.log('🧪 Starting Billing Cron & Engine Unit Tests...\n');

// 1. Date calculation tests
console.log('1. Testing date and cycle mathematics...');
assert.strictEqual(addDays('2026-01-01', 1), '2026-01-02');
assert.strictEqual(addDays('2026-01-31', 1), '2026-02-01');
assert.strictEqual(addDays('2026-02-28', 1), '2026-03-01');

assert.strictEqual(addCycle('2026-01-01', 'daily'), '2026-01-02');
assert.strictEqual(addCycle('2026-01-01', 'weekly'), '2026-01-08');
assert.strictEqual(addCycle('2026-01-01', 'monthly'), '2026-02-01');
assert.strictEqual(addCycle('2026-01-01', 'yearly'), '2027-01-01');
console.log('   ✅ Cycle math passed.');

// 2. Due date calculation tests
console.log('2. Testing payment term due dates...');
assert.strictEqual(calculateDueDate('2026-01-01', 'immediate'), '2026-01-01');
assert.strictEqual(calculateDueDate('2026-01-01', 'net15'), '2026-01-16');
assert.strictEqual(calculateDueDate('2026-01-01', 'net30'), '2026-01-31');
console.log('   ✅ Due date calculation passed.');

// 3. Testing auto-close rule
console.log('3. Testing auto-close rules...');
// Create a temporary plan with auto_close = 1
const planRes = db.prepare(`
  INSERT INTO plans (name, product_id, billing_cycle, price, auto_close, end_date)
  VALUES ('Auto-Close Test Plan', 1, 'monthly', 500, 1, '2026-05-01')
`).run();
const planId = planRes.lastInsertRowid;

// Create a subscription expiring 2026-04-01
const subRes = db.prepare(`
  INSERT INTO subscriptions (sub_number, customer_id, plan_id, status, start_date, expiry_date)
  VALUES ('SUB-TEST-CLOSE', 1, ?, 'active', '2026-01-01', '2026-04-01')
`).run(planId);
const subId = subRes.lastInsertRowid;

// Run auto-close before expiry date
let closed = runAutoClose('2026-03-31');
let currentSub = db.prepare('SELECT status FROM subscriptions WHERE id = ?').get(subId);
assert.strictEqual(currentSub.status, 'active', 'Subscription should remain active before expiry');

// Run auto-close on/after expiry date
closed = runAutoClose('2026-04-01');
currentSub = db.prepare('SELECT status FROM subscriptions WHERE id = ?').get(subId);
assert.strictEqual(currentSub.status, 'closed', 'Subscription should be auto-closed on expiry date');
console.log('   ✅ Auto-close passed.');

// Clean up test subscription and plan
db.prepare('DELETE FROM subscriptions WHERE id = ?').run(subId);
db.prepare('DELETE FROM plans WHERE id = ?').run(planId);

// 4. Testing recurring billing generation
console.log('4. Testing recurring invoice generation...');
// Create active subscription starting 2026-02-01 on monthly plan
const subB = db.prepare(`
  INSERT INTO subscriptions (sub_number, customer_id, plan_id, status, start_date, expiry_date, payment_terms, grand_total)
  VALUES ('SUB-TEST-BILL', 1, 1, 'active', '2026-02-01', '2026-12-31', 'net15', 1180)
`).run();
const subBId = subB.lastInsertRowid;

db.prepare(`
  INSERT INTO subscription_lines (subscription_id, product_id, qty, unit_price, tax_pct, line_total)
  VALUES (?, 1, 1, 1000, 18, 1180)
`).run(subBId);

// Run billing for 2026-02-01
const jobResult1 = runBillingJob('2026-02-01');
const inv1 = db.prepare('SELECT * FROM invoices WHERE subscription_id = ?').get(subBId);
assert.ok(inv1, 'Invoice should be generated for due period');
assert.strictEqual(inv1.billing_period_start, '2026-02-01');
assert.strictEqual(inv1.billing_period_end, '2026-02-28');
assert.strictEqual(inv1.due_date, '2026-02-16'); // 2026-02-01 + 15 days
assert.strictEqual(inv1.grand_total, 1180);

// Run billing again for same date (duplicate check)
const jobResultDuplicate = runBillingJob('2026-02-01');
const invoiceCount = db.prepare('SELECT COUNT(*) as cnt FROM invoices WHERE subscription_id = ?').get(subBId).cnt;
assert.strictEqual(invoiceCount, 1, 'Duplicate invoice should NOT be generated');
console.log('   ✅ Duplicate prevention passed.');

// Run billing for next cycle: 2026-03-01
const jobResult2 = runBillingJob('2026-03-01');
const invoiceCount2 = db.prepare('SELECT COUNT(*) as cnt FROM invoices WHERE subscription_id = ?').get(subBId).cnt;
assert.strictEqual(invoiceCount2, 2, 'Next cycle invoice should be generated');

const inv2 = db.prepare('SELECT * FROM invoices WHERE subscription_id = ? ORDER BY id DESC LIMIT 1').get(subBId);
assert.strictEqual(inv2.billing_period_start, '2026-03-01');
assert.strictEqual(inv2.billing_period_end, '2026-03-31');
console.log('   ✅ Next cycle generation passed.');

// Cleanup
db.prepare('DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE subscription_id = ?)').run(subBId);
db.prepare('DELETE FROM invoices WHERE subscription_id = ?').run(subBId);
db.prepare('DELETE FROM subscription_lines WHERE subscription_id = ?').run(subBId);
db.prepare('DELETE FROM subscriptions WHERE id = ?').run(subBId);

console.log('\n🎉 ALL BILLING CRON TESTS PASSED SUCCESSFULLY!\n');
