const nodemailer = require('nodemailer');

// ── Transporter Configuration ────────────────────────────────────────────────
// Uses Ethereal (test) mail by default. Set SMTP_* env vars for production.
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    // Production SMTP
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Ethereal test account (auto-generated)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`📧 Email: Using Ethereal test account → ${testAccount.user}`);
  }

  return transporter;
}

const FROM_ADDRESS = process.env.SMTP_FROM || '"Brightloop SMS" <noreply@brightloop.in>';

// ── Helper: Rupee formatting ─────────────────────────────────────────────────
const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── 1. Invoice Email ─────────────────────────────────────────────────────────
async function sendInvoiceEmail({ to, customerName, invoice, lines }) {
  const transport = await getTransporter();

  const invNo = invoice.invoice_number || `INV-${String(invoice.id).padStart(4, '0')}`;
  const lineRows = (lines || [])
    .map(
      (l, i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${l.description || `Item #${i + 1}`}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${l.qty || 1}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${fmt(l.unit_price)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${fmt(l.line_total)}</td>
        </tr>`
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#3b82f6;color:#fff;padding:24px;text-align:center">
        <h1 style="margin:0;font-size:24px">Brightloop</h1>
        <p style="margin:4px 0 0;opacity:0.9">Tax Invoice</p>
      </div>

      <div style="padding:24px">
        <p>Dear <strong>${customerName || 'Customer'}</strong>,</p>
        <p>Please find your invoice details below:</p>

        <table style="width:100%;margin:16px 0;background:#f8fafc;border-radius:6px;padding:12px" cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 12px;color:#64748b">Invoice No</td><td style="padding:4px 12px;font-weight:bold">${invNo}</td></tr>
          <tr><td style="padding:4px 12px;color:#64748b">Issue Date</td><td style="padding:4px 12px">${invoice.issue_date || '-'}</td></tr>
          <tr><td style="padding:4px 12px;color:#64748b">Due Date</td><td style="padding:4px 12px;font-weight:bold;color:#ef4444">${invoice.due_date || '-'}</td></tr>
          <tr><td style="padding:4px 12px;color:#64748b">Status</td><td style="padding:4px 12px;text-transform:uppercase">${invoice.status}</td></tr>
        </table>

        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#3b82f6;color:#fff">
              <th style="padding:8px;text-align:left">Description</th>
              <th style="padding:8px;text-align:center">Qty</th>
              <th style="padding:8px;text-align:right">Unit Price</th>
              <th style="padding:8px;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>

        <table style="width:50%;margin-left:auto;margin-top:8px">
          <tr><td style="padding:4px 8px;color:#64748b">Subtotal</td><td style="padding:4px 8px;text-align:right">${fmt(invoice.subtotal)}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b">GST</td><td style="padding:4px 8px;text-align:right">${fmt(invoice.tax_total)}</td></tr>
          ${Number(invoice.discount_total || 0) > 0 ? `<tr><td style="padding:4px 8px;color:#22c55e">Discount</td><td style="padding:4px 8px;text-align:right;color:#22c55e">-${fmt(invoice.discount_total)}</td></tr>` : ''}
          <tr style="border-top:2px solid #3b82f6">
            <td style="padding:8px;font-weight:bold;font-size:16px">Grand Total</td>
            <td style="padding:8px;text-align:right;font-weight:bold;font-size:16px;color:#3b82f6">${fmt(invoice.grand_total)}</td>
          </tr>
        </table>
      </div>

      <div style="background:#f8fafc;padding:16px 24px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0">
        <p style="margin:0">Thank you for your business!</p>
        <p style="margin:4px 0 0">Brightloop Subscription Management System</p>
      </div>
    </div>
  `;

  const info = await transport.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Invoice ${invNo} from Brightloop`,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`📧 Invoice email sent → ${to}${previewUrl ? ` | Preview: ${previewUrl}` : ''}`);
  return { messageId: info.messageId, previewUrl: previewUrl || null };
}

// ── 2. Payment Confirmation Email ────────────────────────────────────────────
async function sendPaymentConfirmationEmail({ to, customerName, payment, invoice }) {
  const transport = await getTransporter();

  const invNo = invoice.invoice_number || `INV-${String(invoice.id).padStart(4, '0')}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#22c55e;color:#fff;padding:24px;text-align:center">
        <h1 style="margin:0;font-size:24px">✓ Payment Received</h1>
        <p style="margin:4px 0 0;opacity:0.9">Thank you for your payment!</p>
      </div>

      <div style="padding:24px">
        <p>Dear <strong>${customerName || 'Customer'}</strong>,</p>
        <p>We have received your payment. Here are the details:</p>

        <table style="width:100%;margin:16px 0;background:#f0fdf4;border-radius:6px" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 12px;color:#64748b">Invoice</td><td style="padding:8px 12px;font-weight:bold">${invNo}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b">Payment Amount</td><td style="padding:8px 12px;font-weight:bold;color:#22c55e;font-size:18px">${fmt(payment.amount)}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b">Method</td><td style="padding:8px 12px;text-transform:uppercase">${payment.method}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b">Date</td><td style="padding:8px 12px">${payment.payment_date || new Date().toISOString().slice(0, 10)}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b">Status</td><td style="padding:8px 12px;font-weight:bold;color:#22c55e">COMPLETED</td></tr>
          ${payment.notes ? `<tr><td style="padding:8px 12px;color:#64748b">Reference</td><td style="padding:8px 12px">${payment.notes}</td></tr>` : ''}
        </table>

        <p style="color:#64748b;font-size:13px">If you have any questions about this payment, please contact our support team.</p>
      </div>

      <div style="background:#f8fafc;padding:16px 24px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0">
        <p style="margin:0">Brightloop Subscription Management System</p>
      </div>
    </div>
  `;

  const info = await transport.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Payment Confirmation - ${invNo} | Brightloop`,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`📧 Payment confirmation sent → ${to}${previewUrl ? ` | Preview: ${previewUrl}` : ''}`);
  return { messageId: info.messageId, previewUrl: previewUrl || null };
}

// ── 3. Renewal Reminder Email ────────────────────────────────────────────────
async function sendRenewalReminderEmail({ to, customerName, subscription, plan, daysLeft }) {
  const transport = await getTransporter();

  const subNo = subscription.sub_number || `SUB-${String(subscription.id).padStart(4, '0')}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#f59e0b;color:#fff;padding:24px;text-align:center">
        <h1 style="margin:0;font-size:24px">⏰ Renewal Reminder</h1>
        <p style="margin:4px 0 0;opacity:0.9">Your subscription is expiring soon</p>
      </div>

      <div style="padding:24px">
        <p>Dear <strong>${customerName || 'Customer'}</strong>,</p>
        <p>Your subscription is set to expire in <strong>${daysLeft} day(s)</strong>. Please renew to continue enjoying uninterrupted service.</p>

        <table style="width:100%;margin:16px 0;background:#fffbeb;border-radius:6px" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 12px;color:#64748b">Subscription</td><td style="padding:8px 12px;font-weight:bold">${subNo}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b">Plan</td><td style="padding:8px 12px">${plan?.name || 'N/A'}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b">Billing Cycle</td><td style="padding:8px 12px;text-transform:capitalize">${plan?.billing_cycle || 'N/A'}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b">Expires On</td><td style="padding:8px 12px;font-weight:bold;color:#ef4444">${subscription.expiry_date || '-'}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b">Amount</td><td style="padding:8px 12px;font-weight:bold">${fmt(subscription.grand_total)}</td></tr>
        </table>

        <div style="text-align:center;margin:24px 0">
          <p style="color:#64748b">Log in to your dashboard to renew your subscription.</p>
        </div>
      </div>

      <div style="background:#f8fafc;padding:16px 24px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0">
        <p style="margin:0">Brightloop Subscription Management System</p>
      </div>
    </div>
  `;

  const info = await transport.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Renewal Reminder - ${subNo} expiring in ${daysLeft} day(s) | Brightloop`,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`📧 Renewal reminder sent → ${to}${previewUrl ? ` | Preview: ${previewUrl}` : ''}`);
  return { messageId: info.messageId, previewUrl: previewUrl || null };
}

module.exports = {
  sendInvoiceEmail,
  sendPaymentConfirmationEmail,
  sendRenewalReminderEmail,
};
