import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getInvoiceById, confirmInvoice, cancelInvoice, applyDiscount, downloadInvoicePdf, sendInvoiceEmail } from '../../api/invoices'
import { getPaymentsByInvoice, createPayment, getUpiQrCode } from '../../api/payments'
import { useAuth } from '../../context/AuthContext'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import { FileDown, Mail, QrCode, Printer, CheckCircle, CreditCard, XCircle, ArrowLeft } from 'lucide-react'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isStaff, isAdmin } = useAuth()
  const [invoice, setInvoice] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Discount code
  const [couponCode, setCouponCode] = useState('')
  const [discountLoading, setDiscountLoading] = useState(false)

  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('upi')
  const [payNotes, setPayNotes] = useState('')
  const [paying, setPaying] = useState(false)

  // UPI QR state
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrData, setQrData] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)

  // PDF & Email state
  const [pdfLoading, setPdfLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getInvoiceById(id)
      const inv = res.data.data || res.data
      setInvoice(inv)
      setPayAmount(inv.grand_total || '')

      try {
        const payRes = await getPaymentsByInvoice(id)
        setPayments(payRes.data.data || payRes.data || [])
      } catch (e) {
        // non-blocking
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load invoice.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  const handleConfirm = async () => {
    try {
      await confirmInvoice(id)
      setSuccess('Invoice confirmed!')
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm.')
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this invoice?')) return
    try {
      await cancelInvoice(id)
      setSuccess('Invoice cancelled.')
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel.')
    }
  }

  const handleApplyDiscount = async (e) => {
    e.preventDefault()
    if (!couponCode.trim()) return
    setDiscountLoading(true)
    setError('')
    setSuccess('')
    try {
      await applyDiscount(id, { code: couponCode.trim() })
      setSuccess('Discount applied successfully!')
      setCouponCode('')
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply discount.')
    } finally {
      setDiscountLoading(false)
    }
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    setPaying(true)
    setError('')
    try {
      await createPayment({
        invoice_id: parseInt(id),
        amount: parseFloat(payAmount) || 0,
        method: payMethod,
        payment_date: new Date().toISOString().slice(0, 10),
        notes: payNotes,
      })
      setShowPayModal(false)
      setSuccess('Payment recorded successfully!')
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment.')
    } finally {
      setPaying(false)
    }
  }

  // ── PDF Download ────────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    setPdfLoading(true)
    setError('')
    try {
      const res = await downloadInvoicePdf(id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.invoice_number || `INV-${String(invoice.id).padStart(4, '0')}`}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setSuccess('PDF downloaded successfully!')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Send Invoice Email ──────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    setEmailLoading(true)
    setError('')
    try {
      const res = await sendInvoiceEmail(id)
      const msg = res.data?.message || 'Invoice email sent!'
      setSuccess(msg)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send email.')
    } finally {
      setEmailLoading(false)
    }
  }

  // ── Show UPI QR ─────────────────────────────────────────────────────────────
  const handleShowQr = async () => {
    setQrLoading(true)
    setError('')
    try {
      const res = await getUpiQrCode(id)
      setQrData(res.data.data || res.data)
      setShowQrModal(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate UPI QR.')
    } finally {
      setQrLoading(false)
    }
  }

  if (loading) return <div className="spinner" style={{ margin: '40px auto' }} />
  if (error && !invoice) return <div className="alert alert-danger">{error}</div>
  if (!invoice) return null

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/invoices')} style={{ marginBottom: 8 }}>
            ← Back to Invoices
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>
              {invoice.invoice_number || `INV-${String(invoice.id).padStart(4, '0')}`}
            </h2>
            <Badge status={invoice.status} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleDownloadPdf} disabled={pdfLoading}>
            {pdfLoading ? <><span className="spinner spinner-sm" /> Generating...</> : <><FileDown size={14} /> Download PDF</>}
          </button>
          {isStaff() && (
            <button className="btn btn-secondary" onClick={handleSendEmail} disabled={emailLoading}>
              {emailLoading ? <><span className="spinner spinner-sm" /> Sending...</> : <><Mail size={14} /> Email Invoice</>}
            </button>
          )}
          {['draft', 'confirmed'].includes(invoice.status) && (
            <button className="btn btn-secondary" onClick={handleShowQr} disabled={qrLoading}>
              {qrLoading ? <><span className="spinner spinner-sm" /> Loading...</> : <><QrCode size={14} /> UPI QR Code</>}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <><Printer size={14} /> Print Invoice</>
          </button>
          {isStaff() && invoice.status === 'draft' && (
            <button className="btn btn-primary" onClick={handleConfirm}>
              Confirm Invoice
            </button>
          )}
          {isStaff() && invoice.status === 'confirmed' && (
            <button className="btn btn-success" onClick={() => setShowPayModal(true)}>
              + Record Payment
            </button>
          )}
          {isStaff() && ['draft', 'confirmed'].includes(invoice.status) && (
            <button className="btn btn-danger" onClick={handleCancel}>
              Cancel Invoice
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>Bill To</h4>
          <p style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 600 }}>
            {invoice.customer_name || 'N/A'}
          </p>
          {invoice.company_name && (
            <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
              {invoice.company_name}
            </p>
          )}
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>Invoice Details</h4>
          <p style={{ margin: '4px 0' }}>
            Issue Date: <strong>{invoice.issue_date || '-'}</strong>
          </p>
          <p style={{ margin: '4px 0' }}>
            Due Date: <strong>{invoice.due_date || '-'}</strong>
          </p>
          {invoice.billing_period_start && (
            <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Billing Cycle: {invoice.billing_period_start} → {invoice.billing_period_end || 'End'}
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Line Items</h3>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Tax %</th>
              <th style={{ textAlign: 'right' }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lines || []).map((l, idx) => (
              <tr key={l.id || idx}>
                <td>{l.description || `Item #${l.product_id || idx + 1}`}</td>
                <td>{l.qty}</td>
                <td>{fmt(l.unit_price)}</td>
                <td>{l.tax_pct}%</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
          }}
        >
          <div>Subtotal: <strong>{fmt(invoice.subtotal)}</strong></div>
          <div>Tax Total: <strong>{fmt(invoice.tax_total)}</strong></div>
          {Number(invoice.discount_total || 0) > 0 && (
            <div style={{ color: 'var(--success)' }}>
              Discount Applied: -<strong>{fmt(invoice.discount_total)}</strong>
            </div>
          )}
          <div style={{ fontSize: '1.3rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
            Total Due: {fmt(invoice.grand_total)}
          </div>
        </div>
      </div>

      {/* Apply Discount Code */}
      {isStaff() && ['draft', 'confirmed'].includes(invoice.status) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>Apply Discount Coupon</h4>
          <form onSubmit={handleApplyDiscount} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="e.g. WELCOME10"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              style={{ maxWidth: '280px' }}
            />
            <button type="submit" className="btn btn-secondary" disabled={discountLoading}>
              {discountLoading ? 'Applying...' : 'Apply Coupon'}
            </button>
          </form>
        </div>
      )}

      {/* Payment History */}
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Payment Records</h3>
        {payments.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No payments recorded yet.</p>
        ) : (
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>#PAY-{p.id}</td>
                  <td><strong>{fmt(p.amount)}</strong></td>
                  <td><span style={{ textTransform: 'uppercase' }}>{p.method}</span></td>
                  <td>{p.payment_date}</td>
                  <td><Badge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Payment Modal */}
      {showPayModal && (
        <Modal
          isOpen={showPayModal}
          onClose={() => setShowPayModal(false)}
          title={`Record Payment for ${invoice.invoice_number || `INV-${invoice.id}`}`}
        >
          <form onSubmit={handleRecordPayment}>
            <div className="form-group">
              <label>Payment Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Payment Method *</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="bank_transfer">Bank Transfer (NEFT / RTGS)</option>
                <option value="card">Credit / Debit Card</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notes / Transaction Reference</label>
              <input
                type="text"
                placeholder="E.g. UPI Ref #123456789"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={paying}>
                {paying ? 'Recording...' : 'Save Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* UPI QR Code Modal */}
      {showQrModal && qrData && (
        <Modal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          title="UPI Payment QR Code"
        >
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <img
              src={qrData.qr_code}
              alt="UPI QR Code"
              style={{ width: 250, height: 250, margin: '0 auto', display: 'block', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}
            />
            <p style={{ marginTop: 16, fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              {fmt(qrData.amount)}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0' }}>
              Invoice: {qrData.invoice_number}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0' }}>
              Pay to: <strong>{qrData.payee_name}</strong> ({qrData.payee_vpa})
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 16 }}>
              Scan this QR code with any UPI app (GPay, PhonePe, Paytm, etc.)
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={() => setShowQrModal(false)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
