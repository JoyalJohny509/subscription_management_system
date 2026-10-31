import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getPayments, createPayment } from '../../api/payments'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import SearchBar from '../../components/SearchBar'
import PaymentForm from './PaymentForm'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function PaymentList() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isStaff } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Parse query params if redirected from invoice
  const query = new URLSearchParams(location.search)
  const queryInvoiceId = query.get('invoice_id')
  const queryAmount = query.get('amount')

  useEffect(() => {
    if (queryInvoiceId) {
      setShowForm(true)
    }
  }, [queryInvoiceId])

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPayments({ status: statusFilter || undefined })
      const list = res.data.data || res.data || []
      const filtered = list.filter((p) => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
          p.invoice_number?.toLowerCase().includes(s) ||
          p.customer_name?.toLowerCase().includes(s) ||
          p.company_name?.toLowerCase().includes(s) ||
          p.notes?.toLowerCase().includes(s)
        )
      })
      setPayments(filtered)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load payments.')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const handleCreate = async (payload) => {
    await createPayment(payload)
    setSuccess('Payment recorded successfully!')
    fetchPayments()
  }

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (_, row) => (
        <a
          href={`/invoices/${row.invoice_id}`}
          onClick={(e) => { e.preventDefault(); navigate(`/invoices/${row.invoice_id}`) }}
          style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}
        >
          {row.invoice_number || `INV-${row.invoice_id}`}
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
    { key: 'amount', label: 'Amount Paid', render: (_, row) => <strong>{fmt(row.amount)}</strong> },
    {
      key: 'method',
      label: 'Method',
      render: (_, row) => (
        <span className="badge badge-active" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
          {row.method}
        </span>
      ),
    },
    {
      key: 'payment_date',
      label: 'Date',
      render: (_, row) => (row.payment_date ? new Date(row.payment_date).toLocaleDateString('en-IN') : '-'),
    },
    { key: 'notes', label: 'Reference / Notes', render: (_, row) => row.notes || '-' },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => <Badge status={row.status} />,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Payments</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Record receipts, track payment methods, and monitor reconciled balances
          </p>
        </div>
        {isStaff() && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Record Payment
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by invoice#, customer, reference..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '180px', padding: '10px 14px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px' }}
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <DataTable columns={columns} data={payments} loading={loading} emptyMessage="No payments recorded." />

      {showForm && (
        <PaymentForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSave={handleCreate}
          initialInvoiceId={queryInvoiceId}
          initialAmount={queryAmount}
        />
      )}
    </div>
  )
}
