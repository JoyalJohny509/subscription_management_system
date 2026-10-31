const assert = require('assert');
const { initializeDB } = require('./src/db/schema');
initializeDB();

const {
  calculateProration,
  upgradeSeats,
  addAddon,
  diffInDays
} = require('./src/services/prorationService');
const db = require('./src/db/database');

console.log('🧪 Starting Proration & Seat Upgrade Unit Tests...\n');

// 1. Math verification
console.log('1. Testing proration formula math...');
const pFull = calculateProration({
  startDate: '2026-02-01',
  endDate: '2026-02-28',
  effectiveDate: '2026-02-01',
  unitPrice: 1000,
  qtyChange: 2,
  taxPct: 18
});
assert.strictEqual(pFull.totalDays, 28);
assert.strictEqual(pFull.remainingDays, 28);
assert.strictEqual(pFull.prorationFactor, 1);
assert.strictEqual(pFull.baseProrated, 2000);
assert.strictEqual(pFull.taxProrated, 360);
assert.strictEqual(pFull.totalProrated, 2360);
console.log('   ✅ Full-cycle proration passed.');

// Mid-cycle: 14 days remaining out of 28
const pMid = calculateProration({
  startDate: '2026-02-01',
  endDate: '2026-02-28',
  effectiveDate: '2026-02-15',
  unitPrice: 1000,
  qtyChange: 2,
  taxPct: 18
});
assert.strictEqual(pMid.totalDays, 28);
assert.strictEqual(pMid.remainingDays, 14);
assert.strictEqual(pMid.prorationFactor, 0.5);
assert.strictEqual(pMid.baseProrated, 1000);
assert.strictEqual(pMid.taxProrated, 180);
assert.strictEqual(pMid.totalProrated, 1180);
console.log('   ✅ Mid-cycle 50% proration passed.');

// 2. Integration with subscription
console.log('2. Testing seat upgrade on active subscription...');

// Pre-cleanup in case of prior aborted run
db.prepare("DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE subscription_id IN (SELECT id FROM subscriptions WHERE sub_number = 'SUB-SEAT-TEST'))").run();
db.prepare("DELETE FROM invoices WHERE subscription_id IN (SELECT id FROM subscriptions WHERE sub_number = 'SUB-SEAT-TEST')").run();
db.prepare("DELETE FROM subscription_lines WHERE subscription_id IN (SELECT id FROM subscriptions WHERE sub_number = 'SUB-SEAT-TEST')").run();
db.prepare("DELETE FROM subscriptions WHERE sub_number = 'SUB-SEAT-TEST'").run();

// Create active subscription with 5 seats @ 1000 INR
const subRes = db.prepare(`
  INSERT INTO subscriptions (sub_number, customer_id, plan_id, status, start_date, expiry_date, payment_terms, grand_total)
  VALUES ('SUB-SEAT-TEST', 1, 1, 'active', '2026-02-01', '2026-12-31', 'net15', 5900)
`).run();
const testSubId = subRes.lastInsertRowid;

const lineRes = db.prepare(`
  INSERT INTO subscription_lines (subscription_id, product_id, description, qty, unit_price, tax_pct, line_total)
  VALUES (?, 1, 'Standard User Seat', 5, 1000, 18, 5900)
`).run(testSubId);
const testLineId = lineRes.lastInsertRowid;

// Seed the initial invoice covering 2026-02-01 to 2026-02-28
const invRes = db.prepare(`
  INSERT INTO invoices (invoice_number, subscription_id, customer_id, status, issue_date, due_date, billing_period_start, billing_period_end, grand_total)
  VALUES ('INV-TEST-CYCLE', ?, 1, 'paid', '2026-02-01', '2026-02-15', '2026-02-01', '2026-02-28', 5900)
`).run(testSubId);
const testInvId = invRes.lastInsertRowid;

// Upgrade from 5 seats to 8 seats on 2026-02-15 (14 remaining days out of 28 -> 50% of 3 seats * 1000 = 1500 + 18% tax = 1770)
const upgradeResult = upgradeSeats({
  subscriptionId: testSubId,
  lineId: testLineId,
  newQty: 8,
  effectiveDate: '2026-02-15'
});

assert.strictEqual(upgradeResult.previous_qty, 5);
assert.strictEqual(upgradeResult.new_qty, 8);
assert.strictEqual(upgradeResult.delta_qty, 3);
assert.strictEqual(upgradeResult.proration.remainingDays, 14);
assert.strictEqual(upgradeResult.proration.totalProrated, 1770);
assert.ok(upgradeResult.invoice, 'Pro-rated invoice should be generated');
assert.strictEqual(upgradeResult.invoice.grand_total, 1770);
assert.strictEqual(upgradeResult.invoice.billing_period_start, '2026-02-15');
assert.strictEqual(upgradeResult.invoice.billing_period_end, '2026-02-28');

// Verify subscription was updated for subsequent cycles
const updatedLine = db.prepare('SELECT * FROM subscription_lines WHERE id = ?').get(testLineId);
assert.strictEqual(updatedLine.qty, 8);
assert.strictEqual(updatedLine.line_total, 9440); // 8 * 1000 * 1.18 = 9440

const updatedSub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(testSubId);
assert.strictEqual(updatedSub.grand_total, 9440);
console.log('   ✅ Mid-cycle seat upgrade & invoice generated successfully.');

// 3. Testing mid-cycle add-on
console.log('3. Testing mid-cycle add-on...');
const addonResult = addAddon({
  subscriptionId: testSubId,
  productId: 2,
  description: '100GB Extra Storage',
  qty: 2,
  unitPrice: 500,
  taxPct: 18,
  effectiveDate: '2026-02-15'
});
// 2 addons * 500 = 1000 * 50% = 500 + 18% tax = 590
assert.strictEqual(addonResult.proration.totalProrated, 590);
assert.ok(addonResult.invoice);
assert.strictEqual(addonResult.invoice.grand_total, 590);

// Verify total lines is 2
const subLines = db.prepare('SELECT * FROM subscription_lines WHERE subscription_id = ?').all(testSubId);
assert.strictEqual(subLines.length, 2);
console.log('   ✅ Mid-cycle add-on passed.');

// Cleanup
db.prepare('DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE subscription_id = ?)').run(testSubId);
db.prepare('DELETE FROM invoices WHERE subscription_id = ?').run(testSubId);
db.prepare('DELETE FROM subscription_lines WHERE subscription_id = ?').run(testSubId);
db.prepare('DELETE FROM subscriptions WHERE id = ?').run(testSubId);

console.log('\n🎉 ALL PRORATION & SEAT UPGRADE TESTS PASSED!\n');
