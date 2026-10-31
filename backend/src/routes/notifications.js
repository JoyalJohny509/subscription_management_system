const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { sendRenewalReminderEmail } = require('../services/emailService');

const router = express.Router();
router.use(authenticate);

// ── POST /api/notifications/renewal-reminder ──────────────────────────────────
// Send renewal reminder emails for subscriptions expiring within N days
router.post('/renewal-reminder', authorize('admin', 'staff'), async (req, res) => {
  try {
    const { days_before = 7 } = req.body;

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days_before);

    const todayStr  = today.toISOString().slice(0, 10);
    const futureStr = futureDate.toISOString().slice(0, 10);

    // Find active subscriptions expiring within the window
    const subscriptions = db.prepare(`
      SELECT s.*,
             u.name AS customer_name, u.email AS customer_email,
             pl.name AS plan_name, pl.billing_cycle
      FROM subscriptions s
      JOIN customers c ON c.id = s.customer_id
      JOIN users u ON u.id = c.user_id
      JOIN plans pl ON pl.id = s.plan_id
      WHERE s.status = 'active'
        AND s.expiry_date >= ?
        AND s.expiry_date <= ?
    `).all(todayStr, futureStr);

    if (subscriptions.length === 0) {
      return res.json({
        data: { sent: 0, subscriptions: [] },
        message: `No subscriptions expiring within ${days_before} days`,
      });
    }

    const results = [];

    for (const sub of subscriptions) {
      if (!sub.customer_email) continue;

      const daysLeft = Math.ceil(
        (new Date(sub.expiry_date) - today) / (1000 * 60 * 60 * 24)
      );

      try {
        const emailResult = await sendRenewalReminderEmail({
          to: sub.customer_email,
          customerName: sub.customer_name,
          subscription: sub,
          plan: { name: sub.plan_name, billing_cycle: sub.billing_cycle },
          daysLeft,
        });

        results.push({
          subscription_id: sub.id,
          sub_number: sub.sub_number,
          customer_email: sub.customer_email,
          days_left: daysLeft,
          status: 'sent',
          messageId: emailResult.messageId,
          previewUrl: emailResult.previewUrl,
        });
      } catch (emailErr) {
        console.error(`[Renewal Email Error] Sub ${sub.id}:`, emailErr);
        results.push({
          subscription_id: sub.id,
          sub_number: sub.sub_number,
          customer_email: sub.customer_email,
          days_left: daysLeft,
          status: 'failed',
          error: emailErr.message,
        });
      }
    }

    return res.json({
      data: {
        sent: results.filter((r) => r.status === 'sent').length,
        failed: results.filter((r) => r.status === 'failed').length,
        details: results,
      },
      message: `Renewal reminders processed for ${results.length} subscription(s)`,
    });
  } catch (err) {
    console.error('[Renewal Reminder Error]', err);
    return res.status(500).json({ error: 'Failed to process renewal reminders' });
  }
});

// ── POST /api/notifications/send-invoice/:id ──────────────────────────────────
// Convenience alias — redirects to invoice send-email endpoint
router.post('/send-invoice/:id', authorize('admin', 'staff'), async (req, res) => {
  try {
    const { sendInvoiceEmail } = require('../services/emailService');

    const invoice = db.prepare(`
      SELECT i.*, c.company_name, u.name AS customer_name, u.email AS customer_email
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      JOIN users u ON u.id = c.user_id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.customer_email) {
      return res.status(400).json({ error: 'Customer email not available' });
    }

    const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ?').all(req.params.id);

    const result = await sendInvoiceEmail({
      to: invoice.customer_email,
      customerName: invoice.customer_name,
      invoice,
      lines,
    });

    return res.json({
      data: result,
      message: `Invoice email sent to ${invoice.customer_email}`,
    });
  } catch (err) {
    console.error('[Send Invoice Email Error]', err);
    return res.status(500).json({ error: 'Failed to send invoice email' });
  }
});

module.exports = router;
