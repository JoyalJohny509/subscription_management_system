import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSubscriptions, upgradeSeats } from '../../api/subscriptions'
import { getInvoices, downloadInvoicePdf } from '../../api/invoices'
import { getPayments } from '../../api/payments'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import UpiPaymentModal from '../../components/UpiPaymentModal'

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

  // UPI QR Payment Modal
  const [upiInvoice, setUpiInvoice] = useState(null)
  const [showUpiModal, setShowUpiModal] = useState(false)

  // Seat upgrade modal
  const [showSeatModal, setShowSeatModal] = useState(false)
  const [requestedSeats, setRequestedSeats] = useState(5)
  const [upgradingSeat, setUpgradingSeat] = useState(false)

  const loadPortalData = useCallback(async () => {
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
  }, [toast])

  useEffect(() => {
    loadPortalData()
  }, [loadPortalData])

  const activeSub = subscriptions.find((s) => s.status === 'active') || subscriptions[0]
  const unpaidInvoices = invoices.filter((i) => i.status === 'confirmed')
  const totalOutstanding = unpaidInvoices.reduce((sum, i) => sum + (i.grand_total || 0), 0)

  // One-click PDF download using Member 3's backend pdfGenerator
  const handleDownloadPdf = async (inv) => {
    try {
      toast.info('Generating official PDF invoice...')
      const res = await downloadInvoicePdf(inv.id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${inv.invoice_number || `INV-${inv.id}`}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Official PDF downloaded!')
    } catch (err) {
      toast.error('Failed to download invoice PDF.')
    }
  }

  // Real prorated seat upgrade using Member 1's backend proration engine
  const handleSeatUpgradeSubmit = async (e) => {
    e.preventDefault()
    if (!activeSub) return
    setUpgradingSeat(true)
    try {
      const res = await upgradeSeats(activeSub.id, {
        new_qty: parseInt(requestedSeats),
        effective_date: new Date().toISOString().slice(0, 10),
      })
      toast.success(res.data.message || 'Seats upgraded with pro-rated billing calculation!')
      setShowSeatModal(false)
      loadPortalData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to adjust seats.')
    } finally {
      setUpgradingSeat(false)
    }
  }

  const openUpiPayment = (inv) => {
    setUpiInvoice(inv)
    setShowUpiModal(true)
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
    <div style={{ width: '100%', margin: '0 auto' }}>
      {/* Welcome Hero Banner */}
      <div className="portal-hero">
        <div className="portal-hero-inner">
          <div className="portal-hero-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="portal-plan-tag">Customer Portal</span>
              <span className="kpi-chip">Sprint 2 Active</span>
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '4px 0' }}>
              Welcome back, {user?.name || 'Customer'}!
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
              Manage your business subscription licenses, download official invoices, and settle payments with instant UPI.
            </p>
          </div>

          <div className="portal-hero-actions">
            {activeSub && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setRequestedSeats(8)
                  setShowSeatModal(true)
                }}
              >
                ⚡ Live Seat Upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Outstanding Due Alert */}
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
            onClick={() => openUpiPayment(unpaidInvoices[0])}
          >
            Pay with UPI QR →
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
            Cycle: {activeSub?.expiry_date ? `Ends ${activeSub.expiry_date}` : 'Ongoing'}
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
          🧾 Invoices & PDF Downloads ({invoices.length})
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Your Subscriptions</h3>
            {activeSub && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSeatModal(true)}>
                + Change Seats
              </button>
            )}
          </div>

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
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Billing Invoices & PDF Statements</h3>
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
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDownloadPdf(inv)}
                            title="Download official branded PDF invoice"
                          >
                            📄 PDF
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/invoices/${inv.id}`)}
                          >
                            View
                          </button>
                          {inv.status === 'confirmed' && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => openUpiPayment(inv)}
                            >
                              Pay UPI
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

      {/* Live Prorated Seat Adjustment Modal */}
      {showSeatModal && (
        <Modal
          isOpen={showSeatModal}
          onClose={() => setShowSeatModal(false)}
          title="Live License Seat Adjustment (Prorated)"
        >
          <form onSubmit={handleSeatUpgradeSubmit}>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
              Instantly adjust active license seats. The system automatically computes pro-rated charges for the remaining days in your billing cycle.
            </p>

            <div className="form-group">
              <label>New Target Seat Count *</label>
              <input
                type="number"
                min="1"
                max="500"
                value={requestedSeats}
                onChange={(e) => setRequestedSeats(e.target.value)}
                required
              />
            </div>

            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                marginBottom: 16,
                fontSize: '0.85rem',
              }}
            >
              <div>✨ <strong>Automated Proration:</strong></div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                If you increase seats mid-cycle, an invoice will be automatically generated with prorated amounts for only the remaining days in the active month.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSeatModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={upgradingSeat}>
                {upgradingSeat ? 'Calculating & Updating...' : 'Confirm Seat Change'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* UPI QR Payment Modal */}
      {showUpiModal && upiInvoice && (
        <UpiPaymentModal
          isOpen={showUpiModal}
          onClose={() => {
            setShowUpiModal(false)
            setUpiInvoice(null)
          }}
          invoice={upiInvoice}
          onPaymentSuccess={() => {
            loadPortalData()
          }}
        />
      )}
    </div>
  )
}
