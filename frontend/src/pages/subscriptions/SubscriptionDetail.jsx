import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getSubscriptionById,
  confirmSubscription,
  activateSubscription,
  pauseSubscription,
  closeSubscription,
} from '../../api/subscriptions'
import { generateInvoiceFromSub, getInvoices } from '../../api/invoices'
import { useAuth } from '../../context/AuthContext'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import UpiPaymentModal from '../../components/UpiPaymentModal'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function SubscriptionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isStaff, isAdmin } = useAuth()
  const [sub, setSub] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Invoice generate modal
  const [showGenModal, setShowGenModal] = useState(false)
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [generating, setGenerating] = useState(false)
  const [upiInvoice, setUpiInvoice] = useState(null)
  const [showUpiModal, setShowUpiModal] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getSubscriptionById(id)
      const subData = res.data.data || res.data
      setSub(subData)

      // Fetch related invoices
      try {
        const invRes = await getInvoices()
        const allInvs = invRes.data.data || invRes.data || []
        setInvoices(allInvs.filter((i) => String(i.subscription_id) === String(id)))
      } catch (e) {
        // invoices fetch error non-blocking
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load subscription.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  const handleAction = async (actionFn, successMsg) => {
    setError('')
    setSuccess('')
    try {
      await actionFn(id)
      setSuccess(successMsg)
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.')
    }
  }

  const handleGenerateInvoice = async (e) => {
    e.preventDefault()
    setGenerating(true)
    setError('')
    try {
      const res = await generateInvoiceFromSub(id, {
        issue_date: issueDate,
        due_date: dueDate || null,
        billing_period_start: periodStart || null,
        billing_period_end: periodEnd || null,
      })
      setShowGenModal(false)
      const invId = res.data.data?.id || res.data.id
      setSuccess('Invoice generated successfully!')
      fetchData()
      if (invId) navigate(`/invoices/${invId}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate invoice.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="spinner" style={{ margin: '40px auto' }} />
  if (error && !sub) return <div className="alert alert-danger">{error}</div>
  if (!sub) return null

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/subscriptions')} style={{ marginBottom: 8 }}>
            ← Back to Subscriptions
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>
              {sub.sub_number || `SUB-${String(sub.id).padStart(4, '0')}`}
            </h2>
            <Badge status={sub.status} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isStaff() && ['draft', 'quotation'].includes(sub.status) && (
            <button
              className="btn btn-primary"
              onClick={() => handleAction(confirmSubscription, 'Subscription confirmed!')}
            >
              Confirm Subscription
            </button>
          )}

          {isStaff() && sub.status === 'confirmed' && (
            <button
              className="btn btn-success"
              onClick={() => handleAction(activateSubscription, 'Subscription activated!')}
            >
              Activate Subscription
            </button>
          )}

          {isStaff() && sub.status === 'active' && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => setShowGenModal(true)}
              >
                + Generate Invoice
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleAction(pauseSubscription, 'Subscription paused')}
              >
                Pause
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleAction(closeSubscription, 'Subscription closed')}
              >
                Close
              </button>
            </>
          )}

          {isStaff() && sub.status === 'paused' && (
            <>
              <button
                className="btn btn-success"
                onClick={() => handleAction(activateSubscription, 'Subscription resumed')}
              >
                Resume
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleAction(closeSubscription, 'Subscription closed')}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>Customer Information</h4>
          <p style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 600 }}>
            {sub.customer_name || 'N/A'}
          </p>
          {sub.company_name && (
            <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
              Company: {sub.company_name}
            </p>
          )}
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>Plan & Duration</h4>
          <p style={{ margin: '4px 0' }}>
            Plan: <strong>{sub.plan_name || 'Default Plan'}</strong>
          </p>
          <p style={{ margin: '4px 0' }}>
            Period: {sub.start_date || 'N/A'} → {sub.expiry_date || 'Ongoing'}
          </p>
          <p style={{ margin: '4px 0' }}>
            Payment Terms: <span style={{ textTransform: 'capitalize' }}>{sub.payment_terms || 'Immediate'}</span>
          </p>
          {sub.notes && (
            <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
              Notes: {sub.notes}
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Subscription Items</h3>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty (Seats)</th>
              <th>Unit Price</th>
              <th>Tax %</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(sub.lines || []).map((l, idx) => (
              <tr key={l.id || idx}>
                <td>{l.description || `Product #${l.product_id}`}</td>
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
          <div>Subtotal: <strong>{fmt(sub.subtotal)}</strong></div>
          <div>Tax Total: <strong>{fmt(sub.tax_total)}</strong></div>
          <div style={{ fontSize: '1.3rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
            Recurring Grand Total: {fmt(sub.grand_total)}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Invoice History</h3>
          {isStaff() && sub.status === 'active' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowGenModal(true)}>
              + Generate Next Invoice
            </button>
          )}
        </div>

        {invoices.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No invoices generated yet.</p>
        ) : (
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <a
                      href={`/invoices/${inv.id}`}
                      onClick={(e) => { e.preventDefault(); navigate(`/invoices/${inv.id}`) }}
                      style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {inv.invoice_number || `INV-${String(inv.id).padStart(4, '0')}`}
                    </a>
                  </td>
                  <td>{inv.issue_date || '-'}</td>
                  <td>{inv.due_date || '-'}</td>
                  <td>{fmt(inv.grand_total)}</td>
                  <td><Badge status={inv.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                    >
                      View
                    </button>
                    {['draft', 'confirmed'].includes(inv.status) && (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => { setUpiInvoice(inv); setShowUpiModal(true) }}
                        title="Pay invoice instantly with UPI QR code"
                        style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                      >
                        <span>📲</span> Pay with QR
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showUpiModal && upiInvoice && (
        <UpiPaymentModal
          isOpen={showUpiModal}
          onClose={() => { setShowUpiModal(false); setUpiInvoice(null) }}
          invoice={upiInvoice}
          onPaymentSuccess={() => {
            fetchSub()
            setSuccess('Payment settled successfully via UPI!')
          }}
        />
      )}

      {showGenModal && (
        <Modal
          isOpen={showGenModal}
          onClose={() => setShowGenModal(false)}
          title="Generate Invoice from Subscription"
        >
          <form onSubmit={handleGenerateInvoice}>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
              Generates a billing cycle invoice copying active seats and pricing.
            </p>
            <div className="form-group">
              <label>Issue Date *</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Billing Period Start</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Billing Period End</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowGenModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={generating}>
                {generating ? 'Generating...' : 'Generate Invoice'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
