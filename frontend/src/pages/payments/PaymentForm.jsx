import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'
import { getInvoices } from '../../api/invoices'

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Customer Payment">
      <form onSubmit={handleSubmit}>
        {errors.form && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{errors.form}</div>}

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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
