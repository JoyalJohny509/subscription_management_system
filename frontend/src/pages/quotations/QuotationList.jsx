import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getQuotations, sendQuotation, acceptQuotation, rejectQuotation, deleteQuotation } from '../../api/quotations'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import SearchBar from '../../components/SearchBar'
import Pagination from '../../components/Pagination'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function QuotationList() {
  const navigate = useNavigate()
  const { isAdmin, isStaff } = useAuth()
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getQuotations({ status: statusFilter || undefined })
      const list = res.data.data || res.data || []
      const filtered = list.filter((q) => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
          q.quotation_number?.toLowerCase().includes(s) ||
          q.customer_name?.toLowerCase().includes(s) ||
          q.company_name?.toLowerCase().includes(s)
        )
      })
      setQuotations(filtered)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load quotations.')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  const handleSend = async (id) => {
    try {
      await sendQuotation(id)
      setSuccess('Quotation sent successfully!')
      fetchQuotations()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send quotation.')
    }
  }

  const handleAccept = async (id) => {
    try {
      const res = await acceptQuotation(id)
      setSuccess('Quotation accepted! Converted to subscription.')
      fetchQuotations()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept quotation.')
    }
  }

  const handleReject = async (id) => {
    if (!window.confirm('Reject this quotation?')) return
    try {
      await rejectQuotation(id)
      fetchQuotations()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject quotation.')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quotation?')) return
    try {
      await deleteQuotation(id)
      fetchQuotations()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete quotation.')
    }
  }

  const columns = [
    {
      key: 'quotation_number',
      label: 'Quotation #',
      render: (row) => (
        <a
          href={`/quotations/${row.id}`}
          onClick={(e) => { e.preventDefault(); navigate(`/quotations/${row.id}`) }}
          style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}
        >
          {row.quotation_number || `QUO-${String(row.id).padStart(4, '0')}`}
        </a>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => (
        <div>
          <div>{row.customer_name || 'N/A'}</div>
          {row.company_name && (
            <small style={{ color: 'var(--text-secondary)' }}>{row.company_name}</small>
          )}
        </div>
      ),
    },
    { key: 'grand_total', label: 'Total Amount', render: (row) => fmt(row.grand_total) },
    { key: 'validity_days', label: 'Validity', render: (row) => `${row.validity_days || 30} days` },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (row) => (row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/quotations/${row.id}`)}
          >
            View
          </button>
          {isStaff() && row.status === 'draft' && (
            <button className="btn btn-primary btn-sm" onClick={() => handleSend(row.id)}>
              Send
            </button>
          )}
          {isStaff() && row.status === 'sent' && (
            <>
              <button className="btn btn-success btn-sm" onClick={() => handleAccept(row.id)}>
                Accept
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleReject(row.id)}>
                Reject
              </button>
            </>
          )}
          {isAdmin() && row.status === 'draft' && (
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row.id)}>
              Delete
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Quotations</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Prepare, send, and convert pricing quotations into confirmed subscriptions
          </p>
        </div>
        {isStaff() && (
          <button className="btn btn-primary" onClick={() => navigate('/quotations/new')}>
            + Create Quotation
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by number, customer..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '180px', padding: '10px 14px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px' }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <DataTable columns={columns} data={quotations} loading={loading} emptyMessage="No quotations found." />
    </div>
  )
}
