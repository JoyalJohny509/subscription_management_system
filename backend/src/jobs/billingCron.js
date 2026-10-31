const cron = require('node-cron');
const db = require('../db/database');

function padId(id, prefix) {
  return `${prefix}${String(id).padStart(4, '0')}`;
}

function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(dateStr, numDays) {
  const dt = parseDate(dateStr);
  if (!dt) return dateStr;
  dt.setUTCDate(dt.getUTCDate() + numDays);
  return formatDate(dt);
}

function addCycle(dateStr, cycle) {
  const dt = parseDate(dateStr);
  if (!dt) return dateStr;

  switch (cycle) {
    case 'daily':
      dt.setUTCDate(dt.getUTCDate() + 1);
      break;
    case 'weekly':
      dt.setUTCDate(dt.getUTCDate() + 7);
      break;
    case 'monthly':
      dt.setUTCMonth(dt.getUTCMonth() + 1);
      break;
    case 'yearly':
      dt.setUTCFullYear(dt.getUTCFullYear() + 1);
      break;
    default:
      dt.setUTCMonth(dt.getUTCMonth() + 1);
  }
  return formatDate(dt);
}

function calculateDueDate(issueDateStr, paymentTerms) {
  const terms = String(paymentTerms || 'immediate').toLowerCase().trim();
  if (terms === 'immediate') return issueDateStr;
  if (terms === 'net15' || terms === '15_days' || terms === '15 days') return addDays(issueDateStr, 15);
  if (terms === 'net30' || terms === '30_days' || terms === '30 days') return addDays(issueDateStr, 30);
  if (terms === 'net60' || terms === '60_days' || terms === '60 days') return addDays(issueDateStr, 60);
  return issueDateStr;
}

/**
 * Auto-Close subscriptions whose expiry_date or plan end_date is reached,
 * if the plan has auto_close = 1.
 */
function runAutoClose(todayStr) {
  const closed = [];
  const candidates = db.prepare(`
    SELECT s.id, s.sub_number, s.customer_id, s.expiry_date,
           pl.auto_close, pl.end_date AS plan_end_date
    FROM subscriptions s
    JOIN plans pl ON pl.id = s.plan_id
    WHERE s.status = 'active' AND pl.auto_close = 1
  `).all();

  const closeStmt = db.prepare(`
    UPDATE subscriptions
    SET status = 'closed', updated_at = datetime('now')
    WHERE id = ?
  `);

  for (const sub of candidates) {
    let shouldClose = false;
    let reason = '';

    if (sub.expiry_date && sub.expiry_date <= todayStr) {
      shouldClose = true;
      reason = `Subscription expiry date reached (${sub.expiry_date})`;
    } else if (sub.plan_end_date && sub.plan_end_date <= todayStr) {
      shouldClose = true;
      reason = `Plan end date reached (${sub.plan_end_date})`;
    }

    if (shouldClose) {
      closeStmt.run(sub.id);
      closed.push({ id: sub.id, sub_number: sub.sub_number, reason });
      console.log(`[BillingCron] Auto-closed subscription #${sub.id} (${sub.sub_number}): ${reason}`);
    }
  }

  return closed;
}

/**
 * Auto-billing: scans active subscriptions, computes the next billing period,
 * and generates recurring draft invoices without creating duplicates.
 */
function runAutoBilling(todayStr) {
  const generated = [];

  const activeSubs = db.prepare(`
    SELECT s.*, pl.billing_cycle, pl.allow_renewal, pl.auto_close, pl.end_date AS plan_end_date
    FROM subscriptions s
    JOIN plans pl ON pl.id = s.plan_id
    WHERE s.status = 'active'
  `).all();

  const insertInvStmt = db.prepare(`
    INSERT INTO invoices (
      subscription_id, customer_id, issue_date, due_date,
      billing_period_start, billing_period_end,
      subtotal, tax_total, grand_total, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
  `);

  const updateInvNumStmt = db.prepare(`UPDATE invoices SET invoice_number = ? WHERE id = ?`);

  const insertLineStmt = db.prepare(`
    INSERT INTO invoice_lines (invoice_id, product_id, description, qty, unit_price, tax_pct, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const sub of activeSubs) {
    if (sub.expiry_date && sub.expiry_date < todayStr && !sub.allow_renewal) {
      continue;
    }

    const cycle = sub.billing_cycle || 'monthly';
    let maxCatchup = 12;

    while (maxCatchup > 0) {
      maxCatchup--;

      // Get latest invoice for this subscription
      const lastInvoice = db.prepare(`
        SELECT id, issue_date, due_date, billing_period_start, billing_period_end
        FROM invoices
        WHERE subscription_id = ? AND status != 'cancelled'
        ORDER BY billing_period_end DESC, id DESC
        LIMIT 1
      `).get(sub.id);

      let nextPeriodStart;
      if (lastInvoice && lastInvoice.billing_period_end) {
        nextPeriodStart = addDays(lastInvoice.billing_period_end, 1);
      } else if (lastInvoice && lastInvoice.issue_date) {
        const baseStart = sub.start_date || lastInvoice.issue_date;
        const baseEnd = addDays(addCycle(baseStart, cycle), -1);
        nextPeriodStart = addDays(baseEnd, 1);
      } else {
        nextPeriodStart = sub.start_date || todayStr;
      }

      // If next period starts after today, it is not due yet
      if (nextPeriodStart > todayStr) {
        break;
      }

      const nextPeriodEnd = addDays(addCycle(nextPeriodStart, cycle), -1);

      // Check duplicate
      const duplicate = db.prepare(`
        SELECT id FROM invoices
        WHERE subscription_id = ? AND billing_period_start = ? AND billing_period_end = ?
          AND status != 'cancelled'
      `).get(sub.id, nextPeriodStart, nextPeriodEnd);

      if (duplicate) {
        break;
      }

      // Read subscription lines
      const subLines = db.prepare(`SELECT * FROM subscription_lines WHERE subscription_id = ?`).all(sub.id);

      let subtotal = 0;
      let tax_total = 0;
      for (const line of subLines) {
        const base = (line.unit_price || 0) * (line.qty || 1);
        subtotal += base;
        tax_total += base * ((line.tax_pct || 0) / 100);
      }
      const grand_total = subtotal + tax_total;

      const issueDate = todayStr;
      const dueDate = calculateDueDate(issueDate, sub.payment_terms);
      const notes = `Automated recurring invoice for period ${nextPeriodStart} to ${nextPeriodEnd}`;

      const res = insertInvStmt.run(
        sub.id,
        sub.customer_id,
        issueDate,
        dueDate,
        nextPeriodStart,
        nextPeriodEnd,
        subtotal,
        tax_total,
        grand_total,
        notes
      );

      const invId = res.lastInsertRowid;
      const invoiceNumber = padId(invId, 'INV-');
      updateInvNumStmt.run(invoiceNumber, invId);

      for (const line of subLines) {
        insertLineStmt.run(
          invId,
          line.product_id,
          line.description || null,
          line.qty,
          line.unit_price,
          line.tax_pct,
          line.line_total
        );
      }

      generated.push({
        invoice_id: invId,
        invoice_number: invoiceNumber,
        subscription_id: sub.id,
        billing_period_start: nextPeriodStart,
        billing_period_end: nextPeriodEnd,
        grand_total
      });

      console.log(`[BillingCron] Auto-generated ${invoiceNumber} for subscription #${sub.id} (${nextPeriodStart} - ${nextPeriodEnd})`);
    }
  }

  return generated;
}

/**
 * Runs the full automated billing and lifecycle check.
 * @param {string|null} targetDate Optional ISO date string (YYYY-MM-DD). Defaults to UTC today.
 */
function runBillingJob(targetDate = null) {
  const todayStr = targetDate || new Date().toISOString().slice(0, 10);
  console.log(`[BillingCron] Running billing job for date: ${todayStr}`);

  const closed = runAutoClose(todayStr);
  const generated = runAutoBilling(todayStr);

  return {
    success: true,
    runDate: todayStr,
    subscriptionsClosed: closed,
    invoicesGenerated: generated
  };
}

let cronTask = null;

/**
 * Starts the node-cron scheduler.
 * @param {string} cronExpression Standard cron schedule (default: midnight daily).
 */
function startBillingCron(cronExpression = '0 0 * * *') {
  if (cronTask) {
    console.log('[BillingCron] Scheduler is already active.');
    return cronTask;
  }

  console.log(`[BillingCron] Scheduling auto-billing job with expression: "${cronExpression}"`);
  cronTask = cron.schedule(cronExpression, () => {
    console.log('[BillingCron] Triggering daily auto-billing run...');
    try {
      const summary = runBillingJob();
      console.log(`[BillingCron] Daily run completed: ${summary.invoicesGenerated.length} invoice(s) generated, ${summary.subscriptionsClosed.length} subscription(s) closed.`);
    } catch (err) {
      console.error('[BillingCron] Error during scheduled billing run:', err);
    }
  });

  return cronTask;
}

function stopBillingCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[BillingCron] Scheduler stopped.');
  }
}

module.exports = {
  runBillingJob,
  runAutoClose,
  runAutoBilling,
  startBillingCron,
  stopBillingCron,
  addDays,
  addCycle,
  calculateDueDate,
  formatDate,
  parseDate
};
