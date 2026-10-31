import { useState, useEffect, useCallback } from 'react'
import { getSummary } from '../api/dashboard'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'

const fmt = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const fmtDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN') : '—'

function BarChart({ data }) {
  if (!data || data.length === 0) return <div className="text-muted text-sm">No revenue data</div>
  const max = Math.max(...data.map((d) => d.amount || 0)) || 1
  return (
    <div className="bar-chart">
      {data.map((item, i) => {
        const pct = Math.max(4, ((item.amount || 0) / max) * 100)
        return (
          <div key={i} className="bar-chart-item">
            <div className="bar-chart-bar-wrap">
              <div
                className="bar-chart-bar"
                style={{ height: `${pct}%` }}
                title={`${item.month}: ${fmt(item.amount)}`}
              >
                <span className="bar-chart-value" style={{ fontSize: '0.65rem' }}>
                  ₹{Math.round((item.amount || 0) / 1000)}K
                </span>
              </div>
            </div>
            <div className="bar-chart-label">{item.month}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getSummary()
      setSummary(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance Dashboard</h1>
          <p className="page-subtitle">Overview of subscriptions, revenue and billing</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
          {loading ? <span className="spinner spinner-sm" /> : '🔄'} Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && !summary ? (
        <div className="loading-container">
          <div className="spinner spinner-lg" />
          <span>Loading dashboard...</span>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <StatCard
              icon="🔄"
              label="Active Subscriptions"
              value={summary?.active_subscriptions ?? 0}
              color="indigo"
              subtitle="Currently active"
            />
            <StatCard
              icon="💰"
              label="Revenue Received"
              value={fmt(summary?.revenue_received)}
              color="green"
              subtitle="Total paid invoices"
            />
            <StatCard
              icon="⏳"
              label="Outstanding"
              value={fmt(summary?.outstanding)}
              color="amber"
              subtitle="Pending payments"
            />
            <StatCard
              icon="⚠️"
              label="Overdue Invoices"
              value={summary?.overdue_count ?? 0}
              color="red"
              subtitle={fmt(summary?.overdue_amount) + ' overdue'}
            />
          </div>

          {/* Charts + breakdown */}
          <div className="grid-2" style={{ marginBottom: '24px' }}>
            {/* Revenue bar chart */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Monthly Revenue</h3>
                <span className="text-muted text-sm">Last 6 months</span>
              </div>
              <BarChart data={summary?.monthly_revenue || []} />
            </div>

            {/* Subscription status breakdown */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Subscription Status</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(summary?.subscription_breakdown || []).map((item, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Badge status={item.status} />
                    </div>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                      {item.count}
                    </span>
                  </div>
                ))}
                {(!summary?.subscription_breakdown || summary.subscription_breakdown.length === 0) && (
                  <div className="text-muted text-sm">No subscription data</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Invoices</h3>
            </div>
            <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
              <table>
                <thead>
                  <tr>
                    <th>Invoice#</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.recent_invoices || []).map((inv) => (
                    <tr key={inv._id || inv.id}>
                      <td style={{ fontWeight: '600' }}>{inv.invoice_number || inv.number || '—'}</td>
                      <td>{inv.customer?.name || inv.customer_name || '—'}</td>
                      <td style={{ fontWeight: '600' }}>{fmt(inv.grand_total)}</td>
                      <td className="text-muted">{fmtDate(inv.due_date)}</td>
                      <td><Badge status={inv.status} /></td>
                    </tr>
                  ))}
                  {(!summary?.recent_invoices || summary.recent_invoices.length === 0) && (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          <div className="empty-state-icon">🧾</div>
                          <div className="empty-state-text">No recent invoices</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
