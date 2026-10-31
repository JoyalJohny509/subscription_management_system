import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'
import { getProducts } from '../../api/products'

export default function PlanForm({ isOpen, onClose, onSave, initialData }) {
  const isEdit = !!initialData
  const [form, setForm] = useState(
    initialData
      ? { ...initialData }
      : {
          name: '',
          product_id: '',
          billing_cycle: 'monthly',
          price: '',
          min_qty: 1,
          start_date: '',
          end_date: '',
          allow_pause: false,
          allow_early_close: false,
          allow_renewal: true,
          auto_close: false,
          is_active: true,
        }
  )
  const [products, setProducts] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      getProducts({ limit: 100 }).then((res) => {
        setProducts(res.data.products || res.data.data || res.data)
      }).catch(() => {})
    }
  }, [isOpen])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    setErrors((errs) => ({ ...errs, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.price) errs.price = 'Price is required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await onSave({
        ...form,
        price: parseFloat(form.price) || 0,
        min_qty: parseInt(form.min_qty) || 1,
      })
      onClose()
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save plan.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Plan' : 'Add Plan'} size="lg">
      <form onSubmit={handleSubmit}>
        {errors.api && <div className="alert alert-error">{errors.api}</div>}

        <div className="form-row">
          <div className="form-group">
            <label>Plan Name *</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Monthly Basic" />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label>Product</label>
            <select name="product_id" value={form.product_id} onChange={handleChange}>
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Billing Cycle</label>
            <select name="billing_cycle" value={form.billing_cycle} onChange={handleChange}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half Yearly</option>
              <option value="annual">Annual</option>
              <option value="one_time">One Time</option>
            </select>
          </div>
          <div className="form-group">
            <label>Price (₹) *</label>
            <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} placeholder="0.00" />
            {errors.price && <span className="field-error">{errors.price}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Min Quantity</label>
            <input name="min_qty" type="number" min="1" value={form.min_qty} onChange={handleChange} />
          </div>
          <div className="form-group" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Start Date</label>
            <input name="start_date" type="date" value={form.start_date?.split?.('T')?.[0] || form.start_date || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input name="end_date" type="date" value={form.end_date?.split?.('T')?.[0] || form.end_date || ''} onChange={handleChange} />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', margin: '8px 0 16px' }}>
          {[
            ['allow_pause', 'Allow Pause'],
            ['allow_early_close', 'Allow Early Close'],
            ['allow_renewal', 'Allow Renewal'],
            ['auto_close', 'Auto Close'],
          ].map(([key, label]) => (
            <div key={key} className="form-check">
              <input type="checkbox" id={key} name={key} checked={!!form[key]} onChange={handleChange} />
              <label htmlFor={key}>{label}</label>
            </div>
          ))}
        </div>

        <div className="form-check">
          <input type="checkbox" id="plan_active" name="is_active" checked={!!form.is_active} onChange={handleChange} />
          <label htmlFor="plan_active">Active</label>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner spinner-sm" /> Saving...</> : isEdit ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
