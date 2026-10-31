const QRCode = require('qrcode');

// Default UPI merchant details (can be configured via env)
const UPI_ID      = process.env.UPI_ID      || 'brightloop@upi';
const UPI_NAME    = process.env.UPI_NAME    || 'Brightloop SMS';
const CURRENCY    = process.env.UPI_CURRENCY || 'INR';

/**
 * Build a UPI deep-link string for payment.
 *
 * @param {object} opts
 * @param {string} opts.payeeVPA   – UPI ID of the payee (merchant)
 * @param {string} opts.payeeName  – Display name of payee
 * @param {number} opts.amount     – Amount to pay
 * @param {string} opts.txnRef     – Transaction reference / note
 * @param {string} opts.currency   – ISO currency code
 * @returns {string} UPI deep-link URI
 */
function buildUpiUri({ payeeVPA, payeeName, amount, txnRef, currency }) {
  const params = new URLSearchParams();
  params.set('pa', payeeVPA || UPI_ID);
  params.set('pn', payeeName || UPI_NAME);
  params.set('am', Number(amount).toFixed(2));
  params.set('cu', currency || CURRENCY);
  if (txnRef) params.set('tn', txnRef);
  return `upi://pay?${params.toString()}`;
}

/**
 * Generate a UPI QR code as a base64-encoded data URI.
 *
 * @param {object} invoice - Invoice row (needs invoice_number, grand_total)
 * @returns {Promise<{qr_code: string, upi_uri: string, invoice_number: string, amount: number}>}
 */
async function generateUpiQr(invoice) {
  const invoiceNumber = invoice.invoice_number || `INV-${String(invoice.id).padStart(4, '0')}`;
  const amount = Number(invoice.grand_total || 0);

  const upiUri = buildUpiUri({
    payeeVPA:  UPI_ID,
    payeeName: UPI_NAME,
    amount,
    txnRef:    `Payment for ${invoiceNumber}`,
    currency:  CURRENCY,
  });

  // Generate QR code as Data URI (PNG, base64-encoded)
  const qrDataUri = await QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300,
    margin: 2,
    color: { dark: '#1e293b', light: '#ffffff' },
  });

  return {
    qr_code: qrDataUri,
    upi_uri: upiUri,
    invoice_number: invoiceNumber,
    amount,
    payee_vpa: UPI_ID,
    payee_name: UPI_NAME,
  };
}

module.exports = { generateUpiQr, buildUpiUri };
