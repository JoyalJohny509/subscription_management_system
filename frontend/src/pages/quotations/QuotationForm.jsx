import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createQuotation } from '../../api/quotations'
import { getUsers } from '../../api/users'
import { getProducts } from '../../api/products'
import { getPlans } from '../../api/plans'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function QuotationForm() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [customerId, setCustomerId] = useState('')
  const [validityDays, setValidityDays] = useState(30)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([
    { product_id: '', plan_id: '', qty: 1, unit_price: 0, tax_pct: 18 },
  ])

  useEffect(() => {
    async function loadData() {
      try {
        const [cRes, pRes, plRes] = await Promise.all([
          getUsers({ role: 'customer' }),
          getProducts({ limit: 100 }),
          getPlans({ limit: 100 }),
        ])
        setCustomers(cRes.data.data || cRes.data || [])
        setProducts(pRes.data.data || pRes.data || [])
        setPlans(plRes.data.data || plRes.data || [])
      } catch (err) {
        setError('Failed to load customers or products.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleProductChange = (index, prodId) => {
    const prod = products.find((p) => String(p.id) === String(prodId))
    const updated = [...lines]
    updated[index].product_id = prodId
    if (prod) {
      updated[index].unit_price = prod.sales_price || 0
    }
    setLines(updated)
  }

  const handlePlanChange = (index, planId) => {
    const plan = plans.find((p) => String(p.id) === String(planId))
    const updated = [...lines]
    updated[index].plan_id = planId
    if (plan && plan.price) {
      updated[index].unit_price = plan.price
    }
    setLines(updated)
  }

  const handleLineChange = (index, field, value) => {
    const updated = [...lines]
    updated[index][field] = value
    setLines(updated)
  }

  const addLine = () => {
    setLines([...lines, { product_id: '', plan_id: '', qty: 1, unit_price: 0, tax_pct: 18 }])
  }

  const removeLine = (index) => {
    if (lines.length === 1) return
    setLines(lines.filter((_, i) => i !== index))
  }

  // Calculate totals
  let subtotal = 0
  let taxTotal = 0
  lines.forEach((l) => {
    const base = (parseFloat(l.unit_price) || 0) * (parseInt(l.qty) || 1)
    const tax = base * ((parseFloat(l.tax_pct) || 0) / 100)
    subtotal += base
    taxTotal += tax
  })
  const grandTotal = subtotal + taxTotal

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!customerId) {
      setError('Please select a customer.')
      return
    }
    if (lines.some((l) => !l.product_id)) {
      setError('Please select a product for each line item.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        customer_id: parseInt(customerId),
        validity_days: parseInt(validityDays) || 30,
        notes,
        lines: lines.map((l) => ({
          product_id: parseInt(l.product_id),
          plan_id: l.plan_id ? parseInt(l.plan_id) : null,
          qty: parseInt(l.qty) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          tax_pct: parseFloat(l.tax_pct) || 0,
        })),
      }
      const res = await createQuotation(payload)
      navigate('/quotations')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create quotation.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner" style={{ margin: '40px auto' }} />

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2>Create Quotation</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Generate a new pricing proposal for a customer
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/quotations')}>
          Cancel
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Customer & Validity</h3>
          <div className="grid-2">
            <div className="form-group">
              <label>Customer *</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select a Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.customer_id || c.id}>
                    {c.name} {c.company_name ? `(${c.company_name})` : ''} - {c.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Validity Period (days)</label>
              <input
                type="number"
                min="1"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Notes / Terms</label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Includes onboarding and setup assistance..."
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Line Items</h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
              + Add Item
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1.2fr 1fr auto',
                  gap: '10px',
                  alignItems: 'center',
                  background: 'var(--bg-secondary)',
                  padding: '12px',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Product</label>
                  <select
                    value={line.product_id}
                    onChange={(e) => handleProductChange(idx, e.target.value)}
                    required
                  >
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem' }}>Plan (Optional)</label>
                  <select
                    value={line.plan_id}
                    onChange={(e) => handlePlanChange(idx, e.target.value)}
                  >
                    <option value="">Default Price</option>
                    {plans.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name} ({pl.billing_cycle})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem' }}>Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={line.qty}
                    onChange={(e) => handleLineChange(idx, 'qty', e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem' }}>Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => handleLineChange(idx, 'unit_price', e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem' }}>Tax %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={line.tax_pct}
                    onChange={(e) => handleLineChange(idx, 'tax_pct', e.target.value)}
                  />
                </div>

                <div style={{ paddingTop: '18px' }}>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '6px',
            }}
          >
            <div>Subtotal: <strong>{fmt(subtotal)}</strong></div>
            <div>Tax Total: <strong>{fmt(taxTotal)}</strong></div>
            <div style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
              Grand Total: {fmt(grandTotal)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/quotations')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Create Quotation'}
          </button>
        </div>
      </form>
    </div>
  )
}
