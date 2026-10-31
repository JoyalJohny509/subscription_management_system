const PDFDocument = require('pdfkit');

/**
 * Generate a PDF invoice and stream it to the response.
 *
 * @param {object} invoice  - Full invoice row joined with customer/user/subscription/plan data
 * @param {Array}  lines    - Array of invoice_lines
 * @param {import('express').Response} res - Express response object
 */
function generateInvoicePdf(invoice, lines, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // ── Response headers ──────────────────────────────────────────────────────
  const fileName = `${invoice.invoice_number || 'INV-' + String(invoice.id).padStart(4, '0')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  const fmt = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ── Company Header ────────────────────────────────────────────────────────
  doc
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('Brightloop', { align: 'left' });
  doc
    .fontSize(9)
    .font('Helvetica')
    .text('Subscription Management System', { align: 'left' })
    .text('support@brightloop.in | www.brightloop.in', { align: 'left' })
    .moveDown(0.5);

  // Divider
  doc
    .strokeColor('#3b82f6')
    .lineWidth(2)
    .moveTo(50, doc.y)
    .lineTo(50 + pageWidth, doc.y)
    .stroke()
    .moveDown(1);

  // ── TAX INVOICE Title ─────────────────────────────────────────────────────
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('TAX INVOICE', { align: 'center' })
    .moveDown(0.8);

  // ── Two-column: Bill To | Invoice Details ─────────────────────────────────
  const startY = doc.y;
  const colWidth = pageWidth / 2;

  // Left column – Bill To
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Bill To:', 50, startY)
    .font('Helvetica')
    .fontSize(10)
    .text(invoice.customer_name || 'N/A', 50, doc.y + 2);

  if (invoice.company_name) {
    doc.text(invoice.company_name);
  }
  if (invoice.customer_email) {
    doc.text(invoice.customer_email);
  }
  if (invoice.customer_phone) {
    doc.text(`Phone: ${invoice.customer_phone}`);
  }
  if (invoice.customer_address) {
    doc.text(invoice.customer_address);
  }

  const leftEnd = doc.y;

  // Right column – Invoice Details
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Invoice Details:', 50 + colWidth, startY)
    .font('Helvetica')
    .fontSize(10);

  const invNo = invoice.invoice_number || `INV-${String(invoice.id).padStart(4, '0')}`;
  doc.text(`Invoice No: ${invNo}`, 50 + colWidth, doc.y + 2);
  doc.text(`Status: ${(invoice.status || '').toUpperCase()}`, 50 + colWidth);
  doc.text(`Issue Date: ${invoice.issue_date || '-'}`, 50 + colWidth);
  doc.text(`Due Date: ${invoice.due_date || '-'}`, 50 + colWidth);

  if (invoice.billing_period_start) {
    doc.text(`Billing Period: ${invoice.billing_period_start} to ${invoice.billing_period_end || '-'}`, 50 + colWidth);
  }
  if (invoice.sub_number) {
    doc.text(`Subscription: ${invoice.sub_number}`, 50 + colWidth);
  }
  if (invoice.plan_name) {
    doc.text(`Plan: ${invoice.plan_name} (${invoice.billing_cycle || ''})`, 50 + colWidth);
  }

  const rightEnd = doc.y;
  doc.y = Math.max(leftEnd, rightEnd) + 20;

  // ── Line Items Table ──────────────────────────────────────────────────────
  const tableTop = doc.y;
  const cols = {
    desc:   { x: 50,              w: pageWidth * 0.35 },
    qty:    { x: 50 + pageWidth * 0.35, w: pageWidth * 0.10 },
    unit:   { x: 50 + pageWidth * 0.45, w: pageWidth * 0.18 },
    tax:    { x: 50 + pageWidth * 0.63, w: pageWidth * 0.12 },
    total:  { x: 50 + pageWidth * 0.75, w: pageWidth * 0.25 },
  };

  // Header row background
  doc
    .fillColor('#3b82f6')
    .rect(50, tableTop, pageWidth, 22)
    .fill();

  doc
    .fillColor('#ffffff')
    .fontSize(10)
    .font('Helvetica-Bold');

  doc.text('Description',     cols.desc.x + 4,  tableTop + 6, { width: cols.desc.w });
  doc.text('Qty',             cols.qty.x + 4,   tableTop + 6, { width: cols.qty.w });
  doc.text('Unit Price',      cols.unit.x + 4,  tableTop + 6, { width: cols.unit.w });
  doc.text('GST %',           cols.tax.x + 4,   tableTop + 6, { width: cols.tax.w });
  doc.text('Total',           cols.total.x + 4, tableTop + 6, { width: cols.total.w, align: 'right' });

  doc.fillColor('#000000').font('Helvetica').fontSize(9);

  let rowY = tableTop + 26;
  const lineItems = lines || [];

  lineItems.forEach((line, idx) => {
    // Alternate row shading
    if (idx % 2 === 0) {
      doc.fillColor('#f8fafc').rect(50, rowY - 2, pageWidth, 18).fill();
    }

    doc.fillColor('#1e293b');
    doc.text(line.description || `Item #${line.product_id || idx + 1}`, cols.desc.x + 4, rowY, { width: cols.desc.w });
    doc.text(String(line.qty || 1),                                     cols.qty.x + 4,  rowY, { width: cols.qty.w });
    doc.text(fmt(line.unit_price),                                      cols.unit.x + 4, rowY, { width: cols.unit.w });
    doc.text(`${line.tax_pct || 0}%`,                                   cols.tax.x + 4,  rowY, { width: cols.tax.w });
    doc.text(fmt(line.line_total),                                      cols.total.x + 4, rowY, { width: cols.total.w, align: 'right' });
    rowY += 20;

    // Page break if needed
    if (rowY > doc.page.height - 150) {
      doc.addPage();
      rowY = 50;
    }
  });

  // ── Summary Section ───────────────────────────────────────────────────────
  const summaryX = 50 + pageWidth * 0.55;
  const summaryW = pageWidth * 0.45;
  let summaryY = rowY + 20;

  // Divider line
  doc
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .moveTo(summaryX, summaryY - 10)
    .lineTo(summaryX + summaryW, summaryY - 10)
    .stroke();

  doc.fontSize(10).font('Helvetica').fillColor('#1e293b');

  const addSummaryLine = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(label, summaryX, summaryY, { width: summaryW * 0.55 });
    doc.text(value, summaryX + summaryW * 0.55, summaryY, { width: summaryW * 0.45, align: 'right' });
    summaryY += 18;
  };

  addSummaryLine('Subtotal:', fmt(invoice.subtotal));
  addSummaryLine('GST (Tax):', fmt(invoice.tax_total));

  if (Number(invoice.discount_total || 0) > 0) {
    addSummaryLine('Discount:', `- ${fmt(invoice.discount_total)}`);
  }

  // Grand total with highlight
  doc
    .fillColor('#3b82f6')
    .rect(summaryX, summaryY - 2, summaryW, 24)
    .fill();

  doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold');
  doc.text('Grand Total:', summaryX + 4, summaryY + 3, { width: summaryW * 0.55 });
  doc.text(fmt(invoice.grand_total), summaryX + summaryW * 0.55, summaryY + 3, { width: summaryW * 0.45 - 4, align: 'right' });

  summaryY += 34;

  // ── Amount in Words (approximate) ─────────────────────────────────────────
  doc.fillColor('#64748b').fontSize(8).font('Helvetica');
  doc.text(`Amount: ${fmt(invoice.grand_total)}`, 50, summaryY);
  summaryY += 16;

  // ── Footer ────────────────────────────────────────────────────────────────
  doc
    .strokeColor('#e2e8f0')
    .lineWidth(0.5)
    .moveTo(50, summaryY + 10)
    .lineTo(50 + pageWidth, summaryY + 10)
    .stroke();

  doc
    .fontSize(8)
    .fillColor('#94a3b8')
    .font('Helvetica')
    .text('Thank you for your business!', 50, summaryY + 18, { align: 'center', width: pageWidth })
    .text('This is a computer-generated invoice and does not require a signature.', 50, doc.y + 4, { align: 'center', width: pageWidth })
    .text('Brightloop Subscription Management System', 50, doc.y + 4, { align: 'center', width: pageWidth });

  doc.end();
}

module.exports = { generateInvoicePdf };
