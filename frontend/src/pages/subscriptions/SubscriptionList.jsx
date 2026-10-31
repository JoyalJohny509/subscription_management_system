import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSubscriptions, confirmSubscription, activateSubscription, pauseSubscription, closeSubscription } from '../../api/subscriptions'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import SearchBar from '../../components/SearchBar'
import Pagination from '../../components/Pagination'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function SubscriptionList() {
  const navigate = useNavigate()
  const { isStaff, isAdmin } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getSubscriptions({ status: statusFilter || undefined })
      const list = res.data.data || res.data || []
      const filtered = list.filter((s) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          s.sub_number?.toLowerCase().includes(q) ||
          s.customer_name?.toLowerCase().includes(q) ||
          s.company_name?.toLowerCase().includes(q) ||
          s.plan_name?.toLowerCase().includes(q)
        )
      })
      setSubscriptions(filtered)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load subscriptions.')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { fetchSubscriptions() }, [fetchSubscriptions])

  const handleAction = async (actionFn, id, successMsg) => {
    try {
      await actionFn(id)
      setSuccess(successMsg)
      fetchSubscriptions()
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.')
    }
  }

  const columns = [
    {
      key: 'sub_number',
      label: 'Sub #',
      render: (_, row) => (
        <a
          href={`/subscriptions/${row.id}`}
          onClick={(e) => { e.preventDefault(); navigate(`/subscriptions/${row.id}`) }}
          style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}
        >
          {row.sub_number || `SUB-${String(row.id).padStart(4, '0')}`}
        </a>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, row) => (
        <div>
          <div>{row.customer_name || 'N/A'}</div>
          {row.company_name && (
            <small style={{ color: 'var(--text-secondary)' }}>{row.company_name}</small>
          )}
        </div>
      ),
    },
    { key: 'plan_name', label: 'Plan', render: (_, row) => row.plan_name || 'Standard' },
    { key: 'grand_total', label: 'Recurring Total', render: (_, row) => fmt(row.grand_total) },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => <Badge status={row.status} />,
    },
    {
      key: 'period',
      label: 'Duration',
      render: (_, row) => (
        <span style={{ fontSize: '0.85rem' }}>
          {row.start_date || 'Start'} → {row.expiry_date || 'Ongoing'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/subscriptions/${row.id}`)}
          >
            View
          </button>
          {isStaff() && ['draft', 'quotation'].includes(row.status) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleAction(confirmSubscription, row.id, 'Subscription confirmed!')}
            >
              Confirm
            </button>
          )}
          {isStaff() && row.status === 'confirmed' && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => handleAction(activateSubscription, row.id, 'Subscription activated!')}
            >
              Activate
            </button>
          )}
          {isStaff() && row.status === 'paused' && (
            <>
              <button
                className="btn btn-success btn-sm"
                onClick={() => handleAction(activateSubscription, row.id, 'Subscription resumed!')}
              >
                Resume
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleAction(closeSubscription, row.id, 'Subscription closed')}
              >
                Close
              </button>
            </>
          )}
          {isStaff() && row.status === 'active' && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleAction(pauseSubscription, row.id, 'Subscription paused')}
              >
                Pause
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleAction(closeSubscription, row.id, 'Subscription closed')}
              >
                Close
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Subscriptions</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Track active customer subscriptions, renewals, and lifecycle states
          </p>
        </div>
        {isStaff() && (
          <button className="btn btn-primary" onClick={() => navigate('/subscriptions/new')}>
            + Create Subscription
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by number, customer, plan..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '180px', padding: '10px 14px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px' }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="quotation">Quotation</option>
          <option value="confirmed">Confirmed</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <DataTable columns={columns} data={subscriptions} loading={loading} emptyMessage="No subscriptions found." />
    </div>
  )
}
