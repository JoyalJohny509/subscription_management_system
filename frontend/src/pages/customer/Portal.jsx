import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSubscriptions } from '../../api/subscriptions'
import { getInvoices } from '../../api/invoices'
import { getPayments } from '../../api/payments'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function CustomerPortal() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [subscriptions, setSubscriptions] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('subscriptions')

  // Seat upgrade modal
  const [showSeatModal, setShowSeatModal] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)
  const [requestedSeats, setRequestedSeats] = useState(1)
  const [seatNotes, setSeatNotes] = useState('')

  useEffect(() => {
    async function loadPortalData() {
      setLoading(true)
      try {
        const [subRes, invRes, payRes] = await Promise.all([
          getSubscriptions(),
          getInvoices(),
          getPayments(),
        ])
        setSubscriptions(subRes.data.data || subRes.data || [])
        setInvoices(invRes.data.data || invRes.data || [])
        setPayments(payRes.data.data || payRes.data || [])
      } catch (err) {
        toast.error('Failed to load portal data.')
      } finally {
        setLoading(false)
      }
    }
    loadPortalData()
  }, [])

  const activeSub = subscriptions.find((s) => s.status === 'active') || subscriptions[0]
  const unpaidInvoices = invoices.filter((i) => i.status === 'confirmed')
  const totalOutstanding = unpaidInvoices.reduce((sum, i) => sum + (i.grand_total || 0), 0)

  const handleSeatRequest = (e) => {
    e.preventDefault()
    toast.success(`Seat adjustment request submitted for ${requestedSeats} seats! Our account manager will contact you.`)
    setShowSeatModal(false)
    setSeatNotes('')
  }

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <div className="spinner spinner-lg" />
        <span>Loading your customer portal...</span>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Welcome Banner */}
      <div className="portal-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="portal-plan-tag">Customer Portal</span>
              <span className="kpi-chip">Client Account</span>
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '4px 0' }}>
              Welcome back, {user?.name || 'Customer'}!
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
              Manage your business subscription licenses, billing statements, and payment receipts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {activeSub && (
              <button
                className="btn btn-primary"
                onClick={() => { setSelectedSub(activeSub); setShowSeatModal(true); }}
              >
                ⚡ Request Seat Upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Outstanding Due Alert if present */}
      {totalOutstanding > 0 && (
        <div
          className="card"
          style={{
            borderColor: 'var(--warning)',
            background: 'rgba(245, 158, 11, 0.08)',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.8rem' }}>⏳</span>
            <div>
              <strong style={{ color: 'var(--warning)', fontSize: '1rem' }}>
                Pending Balance: {fmt(totalOutstanding)}
              </strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                You have {unpaidInvoices.length} unpaid invoice(s) awaiting payment.
              </div>
            </div>
          </div>
          <button
            className="btn btn-success btn-sm"
            onClick={() => navigate(`/invoices/${unpaidInvoices[0]?.id}`)}
          >
            Pay Latest Invoice →
          </button>
        </div>
      )}

      {/* Quick KPI Cards for Customer */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 4 }}>
            Current Active Plan
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {activeSub?.plan_name || 'Standard Plan'}
          </div>
          <div style={{ marginTop: 6 }}>
            <Badge status={activeSub?.status || 'active'} />
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 4 }}>
            Recurring Cost
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>
            {fmt(activeSub?.grand_total || 0)}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>
            Next billing: {activeSub?.expiry_date || 'Ongoing'}
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 4 }}>
            Invoices Settled
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            {invoices.filter((i) => i.status === 'paid').length} Paid
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>
            {payments.length} payment records logged
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          🔄 My Subscriptions ({subscriptions.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          🧾 Invoices & Statements ({invoices.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          💳 Payment History ({payments.length})
        </button>
      </div>

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Your Subscriptions</h3>
          {subscriptions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No active subscriptions found.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Subscription #</th>
                    <th>Plan</th>
                    <th>Billing Period</th>
                    <th>Recurring Price</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.sub_number || `SUB-${s.id}`}</td>
                      <td>{s.plan_name || 'Standard'}</td>
                      <td>
                        <small>{s.start_date || 'Start'} → {s.expiry_date || 'Ongoing'}</small>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(s.grand_total)}</td>
                      <td><Badge status={s.status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/subscriptions/${s.id}`)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Billing Invoices</h3>
          {invoices.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No invoices issued yet.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.invoice_number || `INV-${inv.id}`}</td>
                      <td>{inv.issue_date || '-'}</td>
                      <td>{inv.due_date || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(inv.grand_total)}</td>
                      <td><Badge status={inv.status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/invoices/${inv.id}`)}
                          >
                            View
                          </button>
                          {inv.status === 'confirmed' && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => navigate(`/invoices/${inv.id}`)}
                            >
                              Pay Now
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Payment Receipts</h3>
          {payments.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No payments logged yet.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Invoice #</th>
                    <th>Amount Paid</th>
                    <th>Method</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>#PAY-{p.id}</td>
                      <td>{p.invoice_number || `INV-${p.invoice_id}`}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(p.amount)}</td>
                      <td><span style={{ textTransform: 'uppercase' }}>{p.method}</span></td>
                      <td>{p.payment_date}</td>
                      <td><Badge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Seat Adjustment Modal */}
      {showSeatModal && (
        <Modal
          isOpen={showSeatModal}
          onClose={() => setShowSeatModal(false)}
          title="Request License Seat Adjustment"
        >
          <form onSubmit={handleSeatRequest}>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
              Add more user seats to your active subscription. Your dedicated Brightloop representative will immediately review and provision the additional seats.
            </p>

            <div className="form-group">
              <label>Target Number of Seats</label>
              <input
                type="number"
                min="1"
                max="500"
                value={requestedSeats}
                onChange={(e) => setRequestedSeats(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Notes / Requirements</label>
              <textarea
                rows="3"
                placeholder="E.g. Adding 5 new team members for Q4 expansion..."
                value={seatNotes}
                onChange={(e) => setSeatNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSeatModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Submit Request
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
