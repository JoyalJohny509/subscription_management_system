import { useState, useEffect, useCallback } from 'react'
import { getPlans, createPlan, updatePlan, deletePlan } from '../../api/plans'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import SearchBar from '../../components/SearchBar'
import Pagination from '../../components/Pagination'
import PlanForm from './PlanForm'
import { Check, Repeat, Clock, Plus, Pencil, Trash2 } from 'lucide-react'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function PlanList() {
  const { isAdmin, isStaff } = useAuth()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editPlan, setEditPlan] = useState(null)

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPlans({ search, billing_cycle: cycleFilter || undefined, page, limit: 20 })
      const data = res.data
      setPlans(data.plans || data.data || data)
      if (data.totalPages) setTotalPages(data.totalPages)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load plans.')
    } finally {
      setLoading(false)
    }
  }, [search, cycleFilter, page])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const handleCreate = async (payload) => {
    await createPlan(payload)
    fetchPlans()
  }

  const handleEdit = async (payload) => {
    await updatePlan(editPlan.id, payload)
    fetchPlans()
  }

  const handleDelete = async (plan) => {
    if (!window.confirm(`Delete plan "${plan.name}"?`)) return
    try {
      await deletePlan(plan.id)
      fetchPlans()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete plan.')
    }
  }

  const columns = [
    { key: 'name', label: 'Plan Name', render: (_, row) => <strong>{row.name}</strong> },
    { key: 'product_name', label: 'Product', render: (_, row) => row.product_name || 'N/A' },
    {
      key: 'billing_cycle',
      label: 'Billing Cycle',
      render: (_, row) => (
        <span className="badge badge-draft" style={{ textTransform: 'capitalize' }}>
          {row.billing_cycle}
        </span>
      ),
    },
    { key: 'price', label: 'Price', render: (_, row) => fmt(row.price) },
    { key: 'min_qty', label: 'Min Qty', render: (_, row) => row.min_qty || 1 },
    {
      key: 'features',
      label: 'Plan Rules',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {row.allow_pause ? <span className="badge badge-active" style={{ fontSize: '0.7rem' }}><Check size={11} style={{ marginRight: 3 }} /> Pause</span> : null}
          {row.allow_renewal ? <span className="badge badge-confirmed" style={{ fontSize: '0.7rem' }}><Repeat size={11} style={{ marginRight: 3 }} /> Renewable</span> : null}
          {row.auto_close ? <span className="badge badge-closed" style={{ fontSize: '0.7rem' }}><Clock size={11} style={{ marginRight: 3 }} /> Auto-Close</span> : null}
          {!row.allow_pause && !row.allow_renewal && !row.auto_close ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Standard</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => <Badge status={row.is_active ? 'active' : 'closed'} />,
    },
    ...(isAdmin()
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setEditPlan(row); setShowForm(true) }}
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
          <h2>Billing Plans</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Configure billing cycles, minimum quantities, and pricing rules
          </p>
        </div>
        {isAdmin() && (
          <button
            className="btn btn-primary"
            onClick={() => { setEditPlan(null); setShowForm(true) }}
          >
            + Add Plan
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search plans..." />
        </div>
        <select
          value={cycleFilter}
          onChange={(e) => { setCycleFilter(e.target.value); setPage(1) }}
          style={{ width: '180px', padding: '10px 14px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px' }}
        >
          <option value="">All Cycles</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <DataTable columns={columns} data={plans} loading={loading} emptyMessage="No billing plans found." />

      <div style={{ marginTop: '16px' }}>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {showForm && (
        <PlanForm
          key={editPlan?.id || 'new'}
          isOpen={showForm}
          onClose={() => { setShowForm(false); setEditPlan(null) }}
          onSave={editPlan ? handleEdit : handleCreate}
          initialData={editPlan}
        />
      )}
    </div>
  )
}
