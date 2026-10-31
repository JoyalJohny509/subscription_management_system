import { useState, useEffect, useCallback } from 'react'
import { getSummary } from '../api/dashboard'
import { triggerBillingCron } from '../api/subscriptions'
import { sendRenewalReminders } from '../api/notifications'
import { useToast } from '../context/ToastContext'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import { Play, Bell, RefreshCw, Repeat, IndianRupee, Clock, AlertTriangle, TrendingUp } from 'lucide-react'

const fmt = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const fmtDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN') : '—'

function RevenueChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        No revenue data recorded yet for this period.
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.amount || 0), 1)

  return (
    <div style={{ marginTop: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
      <div className="bar-chart" style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '0 10px', minWidth: '280px' }}>
        {data.map((item, i) => {
          const pct = Math.max(8, ((item.amount || 0) / max) * 100)
          return (
            <div key={i} className="bar-chart-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: '44px',
                  height: `${pct}%`,
                  background: 'linear-gradient(180deg, var(--accent-primary) 0%, rgba(99, 102, 241, 0.4) 100%)',
                  borderRadius: '6px 6px 0 0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: '6px',
                  position: 'relative',
                  transition: 'height 0.4s ease',
                }}
                title={`${item.month}: ${fmt(item.amount)}`}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  ₹{Math.round((item.amount || 0) / 1000)}k
                </span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {item.month}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [runningJob, setRunningJob] = useState(false)

  const fetchData = useCallback(async (isManual = false) => {
    setLoading(true)
    setError('')
    try {
      const res = await getSummary()
      const data = res.data.data || res.data
      setSummary(data)
      if (isManual) toast.success('Dashboard metrics updated!')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard data.')
      toast.error('Failed to refresh dashboard.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRunBillingCron = async () => {
    setRunningJob(true)
    try {
      const res = await triggerBillingCron()
      const genCount = res.data.data?.invoices_generated || 0
      const closedCount = res.data.data?.auto_closed || 0
      toast.success(`Billing cron completed! ${genCount} invoices generated, ${closedCount} subscriptions auto-closed.`)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to trigger billing cron.')
    } finally {
      setRunningJob(false)
    }
  }

  const handleSendRenewalAlerts = async () => {
    try {
      const res = await sendRenewalReminders(14)
      toast.success(res.data.message || 'Renewal reminder emails dispatched!')
    } catch (err) {
      toast.error('Failed to send renewal alerts.')
    }
  }

  // Advanced SaaS Financial Metrics calculation
  const totalRevenue = Number(summary?.total_revenue || 0)
  const outstanding = Number(summary?.outstanding || 0)
  const activeSubs = Number(summary?.active_subscriptions || 0)

  // Estimated Monthly Recurring Revenue (MRR)
  const estimatedMRR = activeSubs > 0
    ? (totalRevenue > 0 ? Math.round(totalRevenue / Math.max(1, (summary?.monthly_revenue?.length || 1))) : activeSubs * 2500)
    : 0
  const estimatedARR = estimatedMRR * 12
  const arpu = activeSubs > 0 ? Math.round(estimatedMRR / activeSubs) : 0

  // Collection efficiency
  const collectionEfficiency = (totalRevenue + outstanding) > 0
    ? Math.round((totalRevenue / (totalRevenue + outstanding)) * 100)
    : 100

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Executive Finance Dashboard</h1>
            <span className="kpi-chip">Sprint 2 Live</span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0' }}>
            Real-time analytics across subscriptions, cash collection, and billing health
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRunBillingCron}
            disabled={runningJob}
            title="Execute Member 1's automated billing cron immediately"
          >
            {runningJob ? 'Running Job...' : <><Play size={13} style={{ fill: 'currentColor' }} /> Run Auto-Billing</>}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSendRenewalAlerts}
            title="Dispatch Member 3's email renewal alerts"
          >
            <><Bell size={13} /> Send Renewal Alerts</>
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => fetchData(true)} disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : <RefreshCw size={13} />} Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Primary KPI Stat Cards */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <StatCard
          icon={<Repeat size={20} />}
          label="Active Subscriptions"
          value={activeSubs}
          color="indigo"
          subtitle="Contracted clients"
        />
        <StatCard
          icon={<IndianRupee size={20} />}
          label="Revenue Received"
          value={fmt(totalRevenue)}
          color="green"
          subtitle="Settled payments"
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Outstanding Dues"
          value={fmt(outstanding)}
          color="amber"
          subtitle="Pending collections"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Overdue Invoices"
          value={summary?.overdue_invoices ?? 0}
          color="red"
          subtitle="Requires attention"
        />
      </div>

      {/* Advanced Recurring Revenue KPI Strip (MRR & ARR) */}
      <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.9) 0%, rgba(99, 102, 241, 0.08) 100%)' }}>
        <div className="kpi-strip">
          <div className="kpi-item">
            <div className="kpi-label">
              Monthly Recurring (MRR)
            </div>
            <div className="kpi-val" style={{ color: 'var(--accent-primary)' }}>
              {fmt(estimatedMRR)}
            </div>
          </div>

          <div className="kpi-divider" />

          <div className="kpi-item">
            <div className="kpi-label">
              Annual Run Rate (ARR)
            </div>
            <div className="kpi-val" style={{ color: '#38BDF8' }}>
              {fmt(estimatedARR)}
            </div>
          </div>

          <div className="kpi-divider" />

          <div className="kpi-item">
            <div className="kpi-label">
              Avg. Revenue Per Account (ARPU)
            </div>
            <div className="kpi-val" style={{ color: 'var(--text-primary)' }}>
              {fmt(arpu)}
            </div>
          </div>

          <div className="kpi-divider" />

          <div className="kpi-item">
            <div className="kpi-label">
              Collection Efficiency
            </div>
            <div className="kpi-val" style={{ color: collectionEfficiency >= 80 ? 'var(--success)' : 'var(--warning)' }}>
              {collectionEfficiency}%
            </div>
          </div>
        </div>
      </div>

      {/* Charts + Breakdown */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Monthly Revenue Bar Chart */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>Monthly Cash Collections</h3>
              <span className="text-muted text-sm">Settled payments by month</span>
            </div>
            <span className="badge badge-confirmed" style={{ fontSize: '0.75rem' }}>Trend</span>
          </div>
          <RevenueChart data={summary?.monthly_revenue || []} />
        </div>

        {/* Subscription Status Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ margin: 0 }}>Subscription Lifecycle Breakdown</h3>
            <span className="text-muted text-sm">Active vs draft vs closed</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            {(summary?.subscription_status_breakdown || []).map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Badge status={item.status} />
                </div>
                <span style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {item.count}
                </span>
              </div>
            ))}
            {(!summary?.subscription_status_breakdown || summary.subscription_status_breakdown.length === 0) && (
              <div className="text-muted text-sm" style={{ padding: '20px 0', textAlign: 'center' }}>
                No subscription status data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ margin: 0 }}>Recent Invoices Issued</h3>
        </div>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Issue Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.recent_invoices || []).map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: '600' }}>
                    <a href={`/invoices/${inv.id}`} style={{ color: 'var(--accent-primary)' }}>
                      {inv.invoice_number || `INV-${inv.id}`}
                    </a>
                  </td>
                  <td>{inv.customer_name || 'Customer'}</td>
                  <td style={{ fontWeight: '600' }}>{fmt(inv.grand_total)}</td>
                  <td className="text-muted">{fmtDate(inv.issue_date)}</td>
                  <td><Badge status={inv.status} /></td>
                </tr>
              ))}
              {(!summary?.recent_invoices || summary.recent_invoices.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No recent invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
