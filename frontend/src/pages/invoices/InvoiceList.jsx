import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getInvoices, confirmInvoice, cancelInvoice, downloadInvoicePdf } from '../../api/invoices'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import SearchBar from '../../components/SearchBar'
import Pagination from '../../components/Pagination'
import UpiPaymentModal from '../../components/UpiPaymentModal'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function InvoiceList() {
  const navigate = useNavigate()
  const { isStaff, isAdmin } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)
  const [upiInvoice, setUpiInvoice] = useState(null)
  const [showUpiModal, setShowUpiModal] = useState(false)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getInvoices({ status: statusFilter || undefined })
      const list = res.data.data || res.data || []
      const filtered = list.filter((inv) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          inv.invoice_number?.toLowerCase().includes(q) ||
          inv.customer_name?.toLowerCase().includes(q) ||
          inv.company_name?.toLowerCase().includes(q)
        )
      })
      setInvoices(filtered)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load invoices.')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const handleConfirm = async (id) => {
    try {
      await confirmInvoice(id)
      setSuccess('Invoice confirmed!')
      fetchInvoices()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm invoice.')
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this invoice?')) return
    try {
      await cancelInvoice(id)
      fetchInvoices()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel invoice.')
    }
  }

  const handleDownloadPdf = async (inv) => {
    setDownloadingId(inv.id)
    setError('')
    try {
      const res = await downloadInvoicePdf(inv.id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${inv.invoice_number || `INV-${String(inv.id).padStart(4, '0')}`}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setSuccess(`Downloaded ${inv.invoice_number || `INV-${inv.id}`}.pdf`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download PDF.')
    } finally {
      setDownloadingId(null)
    }
  }

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (_, row) => (
        <a
          href={`/invoices/${row.id}`}
          onClick={(e) => { e.preventDefault(); navigate(`/invoices/${row.id}`) }}
          style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}
        >
          {row.invoice_number || `INV-${String(row.id).padStart(4, '0')}`}
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
    { key: 'grand_total', label: 'Amount', render: (_, row) => fmt(row.grand_total) },
    {
      key: 'issue_date',
      label: 'Issue Date',
      render: (_, row) => (row.issue_date ? new Date(row.issue_date).toLocaleDateString('en-IN') : '-'),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (_, row) => (row.due_date ? new Date(row.due_date).toLocaleDateString('en-IN') : '-'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => <Badge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/invoices/${row.id}`)}
          >
            View
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleDownloadPdf(row)}
            disabled={downloadingId === row.id}
          >
            {downloadingId === row.id ? '...' : 'PDF'}
          </button>
          {['draft', 'confirmed'].includes(row.status) && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => { setUpiInvoice(row); setShowUpiModal(true) }}
              title="Pay invoice instantly with UPI QR code"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
            >
              <span>📲</span> Pay with QR
            </button>
          )}
          {isStaff() && row.status === 'draft' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleConfirm(row.id)}
            >
              Confirm
            </button>
          )}
          {isStaff() && row.status === 'confirmed' && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => navigate(`/payments?invoice_id=${row.id}&amount=${row.grand_total}`)}
            >
              Pay
            </button>
          )}
          {isStaff() && ['draft', 'confirmed'].includes(row.status) && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleCancel(row.id)}
            >
              Cancel
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
          <h2>Invoices</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Manage billing, confirm dues, apply discounts, and track payments
          </p>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by invoice#, customer..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '180px', padding: '10px 14px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px' }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <DataTable columns={columns} data={invoices} loading={loading} emptyMessage="No invoices found." />

      {showUpiModal && upiInvoice && (
        <UpiPaymentModal
          isOpen={showUpiModal}
          onClose={() => { setShowUpiModal(false); setUpiInvoice(null) }}
          invoice={upiInvoice}
          onPaymentSuccess={() => {
            fetchInvoices()
            setSuccess('Payment settled successfully via UPI!')
          }}
        />
      )}
    </div>
  )
}
