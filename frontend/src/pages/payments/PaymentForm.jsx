import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'
import { getInvoices } from '../../api/invoices'
import { getUpiQrCode, processWebhook } from '../../api/payments'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function PaymentForm({ isOpen, onClose, onSave, initialInvoiceId, initialAmount }) {
  const [invoices, setInvoices] = useState([])
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId || '')
  const [amount, setAmount] = useState(initialAmount || '')
  const [method, setMethod] = useState('upi')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // UPI QR state
  const [qrData, setQrData] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simSuccess, setSimSuccess] = useState('')

  useEffect(() => {
    if (isOpen) {
      getInvoices({ status: 'confirmed' }).then((res) => {
        const invs = res.data.data || res.data || []
        setInvoices(invs)
        if (initialInvoiceId) {
          setInvoiceId(initialInvoiceId)
          if (initialAmount) setAmount(initialAmount)
        } else if (invs.length > 0 && !invoiceId) {
          setInvoiceId(invs[0].id)
          setAmount(invs[0].grand_total)
        }
      }).catch(() => {})
    }
  }, [isOpen, initialInvoiceId, initialAmount])

  // Load QR code whenever invoice or method is UPI
  useEffect(() => {
    if (isOpen && method === 'upi' && invoiceId) {
      setQrLoading(true)
      getUpiQrCode(invoiceId)
        .then((res) => {
          setQrData(res.data.data || res.data)
        })
        .catch(() => {
          setQrData(null)
        })
        .finally(() => {
          setQrLoading(false)
        })
    } else {
      setQrData(null)
    }
  }, [isOpen, method, invoiceId])

  const handleInvoiceChange = (id) => {
    setInvoiceId(id)
    const selected = invoices.find((i) => String(i.id) === String(id))
    if (selected) {
      setAmount(selected.grand_total)
    }
  }

  const validate = () => {
    const errs = {}
    if (!invoiceId) errs.invoiceId = 'Invoice selection is required'
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'Valid amount is required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await onSave({
        invoice_id: parseInt(invoiceId),
        amount: parseFloat(amount) || 0,
        method,
        payment_date: paymentDate,
        notes,
      })
      onClose()
    } catch (err) {
      setErrors({ form: err.response?.data?.error || 'Failed to record payment' })
    } finally {
      setLoading(false)
    }
  }

  // Simulate payment via Mock Webhook
  const handleSimulatePayment = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSimulating(true)
    setErrors({})
    try {
      const res = await processWebhook({
        invoice_id: parseInt(invoiceId),
        amount: parseFloat(amount) || 0,
        method,
        status: 'completed',
        transaction_id: `SIM-${Date.now()}`,
      })
      setSimSuccess('Payment simulated successfully! Invoice updated to paid.')
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err) {
      setErrors({ form: err.response?.data?.error || 'Webhook simulation failed' })
    } finally {
      setSimulating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Customer Payment">
      <form onSubmit={handleSubmit}>
        {errors.form && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{errors.form}</div>}
        {simSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>{simSuccess}</div>}

        <div className="form-group">
          <label>Select Invoice *</label>
          <select
            value={invoiceId}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            required
          >
            <option value="">Select an Invoice</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number || `INV-${inv.id}`} - {inv.customer_name} ({fmt(inv.grand_total)})
              </option>
            ))}
          </select>
          {errors.invoiceId && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{errors.invoiceId}</span>}
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {errors.amount && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{errors.amount}</span>}
          </div>

          <div className="form-group">
            <label>Payment Method *</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
              <option value="bank_transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="card">Credit / Debit Card</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>

        {/* UPI QR Display when UPI is selected */}
        {method === 'upi' && invoiceId && (
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Scan UPI QR to Pay</h4>
            {qrLoading ? (
              <p style={{ color: 'var(--text-secondary)' }}>Generating UPI QR Code...</p>
            ) : qrData ? (
              <div>
                <img
                  src={qrData.qr_code}
                  alt="UPI QR Code"
                  style={{ width: 180, height: 180, margin: '0 auto', display: 'block', background: '#fff', padding: 8, borderRadius: 6 }}
                />
                <p style={{ margin: '8px 0 2px 0', fontSize: '0.9rem', fontWeight: 600 }}>
                  Amount: {fmt(qrData.amount)}
                </p>
                <small style={{ color: 'var(--text-secondary)' }}>
                  Pay to: {qrData.payee_name} ({qrData.payee_vpa})
                </small>
              </div>
            ) : (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Could not load QR code</p>
            )}
          </div>
        )}

        <div className="grid-2">
          <div className="form-group">
            <label>Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Reference / Transaction ID</label>
            <input
              type="text"
              placeholder="e.g. UTR #, Cheque #, Txn ID"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSimulatePayment}
            disabled={simulating || loading || !invoiceId}
            title="Simulate successful payment via mock gateway webhook"
          >
            {simulating ? 'Simulating...' : '⚡ Simulate Mock Webhook'}
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || simulating}>
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
