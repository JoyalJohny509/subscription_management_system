const db = require('../db/database');
const {
  addDays,
  addCycle,
  calculateDueDate,
  parseDate
} = require('../jobs/billingCron');

function padId(id, prefix) {
  return `${prefix}${String(id).padStart(4, '0')}`;
}

function diffInDays(startStr, endStr) {
  const dt1 = parseDate(startStr);
  const dt2 = parseDate(endStr);
  if (!dt1 || !dt2) return 0;
  const diffTime = dt2.getTime() - dt1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculates pro-rated billing amount given cycle dates and quantity change.
 */
function calculateProration({ startDate, endDate, effectiveDate, unitPrice, qtyChange, taxPct = 0 }) {
  const totalDays = Math.max(1, diffInDays(startDate, endDate) + 1);
  const remainingDays = Math.max(0, Math.min(totalDays, diffInDays(effectiveDate, endDate) + 1));
  const prorationFactor = remainingDays / totalDays;

  const baseProrated = Math.round(qtyChange * unitPrice * prorationFactor * 100) / 100;
  const taxProrated = Math.round(baseProrated * (taxPct / 100) * 100) / 100;
  const totalProrated = Math.round((baseProrated + taxProrated) * 100) / 100;

  return {
    totalDays,
    remainingDays,
    prorationFactor: Math.round(prorationFactor * 10000) / 10000,
    baseProrated,
    taxProrated,
    totalProrated
  };
}

/**
 * Recalculate subscription's subtotal, tax_total, and grand_total from its lines.
 */
function recalculateSubscriptionTotals(subscriptionId) {
  const lines = db.prepare('SELECT * FROM subscription_lines WHERE subscription_id = ?').all(subscriptionId);
  let subtotal = 0;
  let tax_total = 0;

  for (const line of lines) {
    const base = (line.unit_price || 0) * (line.qty || 1);
    subtotal += base;
    tax_total += base * ((line.tax_pct || 0) / 100);
  }

  const grand_total = Math.round((subtotal + tax_total) * 100) / 100;
  subtotal = Math.round(subtotal * 100) / 100;
  tax_total = Math.round(tax_total * 100) / 100;

  db.prepare(`
    UPDATE subscriptions
    SET subtotal = ?, tax_total = ?, grand_total = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(subtotal, tax_total, grand_total, subscriptionId);

  return { subtotal, tax_total, grand_total };
}

/**
 * Finds the current recurring billing cycle (start & end) for the given date.
 */
function getCurrentCyclePeriod(sub, effectiveDate) {
  // Check the last regular (non-prorated) invoice
  const lastRegularInvoice = db.prepare(`
    SELECT * FROM invoices
    WHERE subscription_id = ? AND status != 'cancelled'
      AND (notes IS NULL OR notes NOT LIKE '%Pro-rated%')
    ORDER BY billing_period_end DESC, id DESC LIMIT 1
  `).get(sub.id);

  if (lastRegularInvoice && lastRegularInvoice.billing_period_start && lastRegularInvoice.billing_period_end) {
    if (effectiveDate >= lastRegularInvoice.billing_period_start && effectiveDate <= lastRegularInvoice.billing_period_end) {
      return {
        periodStart: lastRegularInvoice.billing_period_start,
        periodEnd: lastRegularInvoice.billing_period_end
      };
    }
  }

  // Otherwise calculate cycle containing effectiveDate using sub.start_date and cycle
  const cycle = sub.billing_cycle || 'monthly';
  let curStart = sub.start_date || effectiveDate;
  let curEnd = addDays(addCycle(curStart, cycle), -1);

  while (effectiveDate > curEnd) {
    curStart = addDays(curEnd, 1);
    curEnd = addDays(addCycle(curStart, cycle), -1);
  }

  return { periodStart: curStart, periodEnd: curEnd };
}

/**
 * Mid-cycle seat upgrade / downgrade with pro-rated billing calculation.
 */
function upgradeSeats({ subscriptionId, lineId, newQty, effectiveDate = null }) {
  const sub = db.prepare(`
    SELECT s.*, pl.billing_cycle, pl.name AS plan_name
    FROM subscriptions s
    JOIN plans pl ON pl.id = s.plan_id
    WHERE s.id = ?
  `).get(subscriptionId);

  if (!sub) throw new Error('Subscription not found');
  if (sub.status !== 'active') throw new Error('Only active subscriptions can have mid-cycle seat adjustments');

  // Find target line
  let line = null;
  if (lineId) {
    line = db.prepare('SELECT * FROM subscription_lines WHERE id = ? AND subscription_id = ?').get(lineId, subscriptionId);
  } else {
    // If lineId not specified, pick the primary product line
    line = db.prepare('SELECT * FROM subscription_lines WHERE subscription_id = ? ORDER BY id ASC LIMIT 1').get(subscriptionId);
  }

  if (!line) throw new Error('Subscription line not found');

  const currentQty = line.qty || 1;
  const targetQty = parseInt(newQty, 10);
  if (isNaN(targetQty) || targetQty < 1) throw new Error('newQty must be a positive integer');
  if (targetQty === currentQty) throw new Error('New quantity matches current quantity; no change needed');

  const deltaQty = targetQty - currentQty;
  const todayStr = effectiveDate || new Date().toISOString().slice(0, 10);

  // Determine current active billing cycle
  const { periodStart, periodEnd } = getCurrentCyclePeriod(sub, todayStr);

  // Calculate proration
  const proration = calculateProration({
    startDate: periodStart,
    endDate: periodEnd,
    effectiveDate: todayStr,
    unitPrice: line.unit_price || 0,
    qtyChange: Math.abs(deltaQty),
    taxPct: line.tax_pct || 0
  });

  let generatedInvoice = null;

  // If upgrade (deltaQty > 0) and days remaining > 0, generate pro-rated invoice
  if (deltaQty > 0 && proration.remainingDays > 0 && proration.totalProrated > 0) {
    const issueDate = todayStr;
    const dueDate = calculateDueDate(issueDate, sub.payment_terms);
    const notes = `Pro-rated seat upgrade: +${deltaQty} seat(s) for ${proration.remainingDays}/${proration.totalDays} remaining days (${todayStr} to ${periodEnd})`;

    const invResult = db.prepare(`
      INSERT INTO invoices (
        subscription_id, customer_id, issue_date, due_date,
        billing_period_start, billing_period_end,
        subtotal, tax_total, grand_total, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(
      sub.id,
      sub.customer_id,
      issueDate,
      dueDate,
      todayStr,
      periodEnd,
      proration.baseProrated,
      proration.taxProrated,
      proration.totalProrated,
      notes
    );

    const invId = invResult.lastInsertRowid;
    const invoiceNumber = padId(invId, 'INV-');
    db.prepare('UPDATE invoices SET invoice_number = ? WHERE id = ?').run(invoiceNumber, invId);

    const lineDesc = `${line.description || 'Seat Upgrade'} (+${deltaQty} seats, prorated ${proration.remainingDays}/${proration.totalDays} days)`;
    db.prepare(`
      INSERT INTO invoice_lines (
        invoice_id, product_id, description, qty, unit_price, tax_pct, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      invId,
      line.product_id,
      lineDesc,
      deltaQty,
      Math.round((line.unit_price * proration.prorationFactor) * 100) / 100,
      line.tax_pct || 0,
      proration.totalProrated
    );

    generatedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
  }

  // Update line quantity & line_total
  const newLineTotal = Math.round(targetQty * (line.unit_price || 0) * (1 + (line.tax_pct || 0) / 100) * 100) / 100;
  db.prepare(`
    UPDATE subscription_lines
    SET qty = ?, line_total = ?
    WHERE id = ?
  `).run(targetQty, newLineTotal, line.id);

  // Recalculate subscription totals
  const newTotals = recalculateSubscriptionTotals(subscriptionId);
  const updatedSub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);

  return {
    subscription: updatedSub,
    line_id: line.id,
    previous_qty: currentQty,
    new_qty: targetQty,
    delta_qty: deltaQty,
    proration,
    invoice: generatedInvoice,
    newTotals
  };
}

/**
 * Add an add-on product mid-cycle with pro-rated billing calculation.
 */
function addAddon({ subscriptionId, productId, variantId = null, description = null, qty = 1, unitPrice, taxPct = 0, effectiveDate = null }) {
  const sub = db.prepare(`
    SELECT s.*, pl.billing_cycle
    FROM subscriptions s
    JOIN plans pl ON pl.id = s.plan_id
    WHERE s.id = ?
  `).get(subscriptionId);

  if (!sub) throw new Error('Subscription not found');
  if (sub.status !== 'active') throw new Error('Only active subscriptions can have mid-cycle add-ons');

  const parsedQty = parseInt(qty, 10);
  if (isNaN(parsedQty) || parsedQty < 1) throw new Error('qty must be at least 1');

  const todayStr = effectiveDate || new Date().toISOString().slice(0, 10);

  const { periodStart, periodEnd } = getCurrentCyclePeriod(sub, todayStr);

  const proration = calculateProration({
    startDate: periodStart,
    endDate: periodEnd,
    effectiveDate: todayStr,
    unitPrice: Number(unitPrice || 0),
    qtyChange: parsedQty,
    taxPct: Number(taxPct || 0)
  });

  let generatedInvoice = null;

  if (proration.remainingDays > 0 && proration.totalProrated > 0) {
    const issueDate = todayStr;
    const dueDate = calculateDueDate(issueDate, sub.payment_terms);
    const notes = `Pro-rated add-on: ${description || 'Add-on'} (qty: ${parsedQty}) for ${proration.remainingDays}/${proration.totalDays} remaining days (${todayStr} to ${periodEnd})`;

    const invResult = db.prepare(`
      INSERT INTO invoices (
        subscription_id, customer_id, issue_date, due_date,
        billing_period_start, billing_period_end,
        subtotal, tax_total, grand_total, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(
      sub.id,
      sub.customer_id,
      issueDate,
      dueDate,
      todayStr,
      periodEnd,
      proration.baseProrated,
      proration.taxProrated,
      proration.totalProrated,
      notes
    );

    const invId = invResult.lastInsertRowid;
    const invoiceNumber = padId(invId, 'INV-');
    db.prepare('UPDATE invoices SET invoice_number = ? WHERE id = ?').run(invoiceNumber, invId);

    const itemDesc = `${description || 'Add-on'} (prorated ${proration.remainingDays}/${proration.totalDays} days)`;
    db.prepare(`
      INSERT INTO invoice_lines (
        invoice_id, product_id, description, qty, unit_price, tax_pct, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      invId,
      productId || null,
      itemDesc,
      parsedQty,
      Math.round((unitPrice * proration.prorationFactor) * 100) / 100,
      taxPct || 0,
      proration.totalProrated
    );

    generatedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
  }

  // Insert into subscription_lines
  const lineBase = parsedQty * Number(unitPrice || 0);
  const lineTax = lineBase * (Number(taxPct || 0) / 100);
  const lineTotal = Math.round((lineBase + lineTax) * 100) / 100;

  const lineResult = db.prepare(`
    INSERT INTO subscription_lines (
      subscription_id, product_id, variant_id, description, qty, unit_price, tax_pct, line_total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    subscriptionId,
    productId || null,
    variantId || null,
    description || null,
    parsedQty,
    Number(unitPrice || 0),
    Number(taxPct || 0),
    lineTotal
  );

  const newTotals = recalculateSubscriptionTotals(subscriptionId);
  const updatedSub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);

  return {
    subscription: updatedSub,
    line_id: lineResult.lastInsertRowid,
    proration,
    invoice: generatedInvoice,
    newTotals
  };
}

module.exports = {
  calculateProration,
  recalculateSubscriptionTotals,
  upgradeSeats,
  addAddon,
  diffInDays
};
