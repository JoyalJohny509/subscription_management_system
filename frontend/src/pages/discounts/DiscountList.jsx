import { useState, useEffect, useCallback } from 'react'
import { getDiscounts, createDiscount, updateDiscount, deleteDiscount } from '../../api/discounts'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import SearchBar from '../../components/SearchBar'
import DiscountForm from './DiscountForm'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function DiscountList() {
  const { isAdmin } = useAuth()
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editDiscount, setEditDiscount] = useState(null)

  const fetchDiscounts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getDiscounts()
      const list = res.data.data || res.data || []
      const filtered = list.filter((d) => {
        if (!search) return true
        const s = search.toLowerCase()
        return d.code?.toLowerCase().includes(s) || d.name?.toLowerCase().includes(s)
      })
      setDiscounts(filtered)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load discounts.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchDiscounts() }, [fetchDiscounts])

  const handleCreate = async (payload) => {
    await createDiscount(payload)
    fetchDiscounts()
  }

  const handleEdit = async (payload) => {
    await updateDiscount(editDiscount.id, payload)
    fetchDiscounts()
  }

  const handleDelete = async (discount) => {
    if (!window.confirm(`Delete discount "${discount.code}"?`)) return
    try {
      await deleteDiscount(discount.id)
      fetchDiscounts()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete discount.')
    }
  }

  const columns = [
    {
      key: 'code',
      label: 'Coupon Code',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)', fontSize: '1rem' }}>
          {row.code}
        </span>
      ),
    },
    { key: 'name', label: 'Rule Name', render: (row) => row.name },
    {
      key: 'value',
      label: 'Discount',
      render: (row) => (
        <strong>
          {row.type === 'percentage' ? `${row.value}%` : fmt(row.value)}
        </strong>
      ),
    },
    {
      key: 'min_amount',
      label: 'Min Amount',
      render: (row) => (row.min_amount ? fmt(row.min_amount) : 'None'),
    },
    {
      key: 'usage',
      label: 'Uses',
      render: (row) => (
        <span>
          {row.uses_count || 0} / {row.max_uses !== null ? row.max_uses : '∞'}
        </span>
      ),
    },
    {
      key: 'validity',
      label: 'Valid Period',
      render: (row) => (
        <span style={{ fontSize: '0.85rem' }}>
          {row.start_date || 'Any'} → {row.end_date || 'Any'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge status={row.is_active ? 'active' : 'closed'} />,
    },
    ...(isAdmin()
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setEditDiscount(row); setShowForm(true) }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(row)}
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Discount Rules</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Create percentage or fixed price promotions, usage limits, and coupon codes
          </p>
        </div>
        {isAdmin() && (
          <button
            className="btn btn-primary"
            onClick={() => { setEditDiscount(null); setShowForm(true) }}
          >
            + Add Discount Rule
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search discount codes or names..." />
      </div>

      <DataTable columns={columns} data={discounts} loading={loading} emptyMessage="No discount rules found." />

      {showForm && (
        <DiscountForm
          isOpen={showForm}
          onClose={() => { setShowForm(false); setEditDiscount(null) }}
          onSave={editDiscount ? handleEdit : handleCreate}
          initialData={editDiscount}
        />
      )}
    </div>
  )
}
