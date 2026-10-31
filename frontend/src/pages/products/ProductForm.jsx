import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'

export default function ProductForm({ isOpen, onClose, onSave, initialData }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    name: '',
    type: '',
    sales_price: '',
    cost_price: '',
    notes: '',
    is_active: true,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        type: initialData.type || '',
        sales_price: initialData.sales_price !== undefined && initialData.sales_price !== null ? initialData.sales_price : '',
        cost_price: initialData.cost_price !== undefined && initialData.cost_price !== null ? initialData.cost_price : '',
        notes: initialData.notes || '',
        is_active: initialData.is_active !== undefined ? Boolean(initialData.is_active) : true,
      })
    } else {
      setForm({ name: '', type: '', sales_price: '', cost_price: '', notes: '', is_active: true })
    }
    setErrors({})
  }, [initialData, isOpen])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    setErrors((errs) => ({ ...errs, [name]: '', api: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.sales_price && form.sales_price !== 0) errs.sales_price = 'Sales price is required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await onSave({
        name: form.name,
        type: form.type,
        sales_price: parseFloat(form.sales_price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        notes: form.notes,
        is_active: form.is_active ? 1 : 0,
      })
      onClose()
    } catch (err) {
      setErrors({ api: err.response?.data?.error || err.response?.data?.message || 'Failed to save product.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add Product'} size="md">
      <form onSubmit={handleSubmit}>
        {errors.api && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errors.api}</div>}

        <div className="form-group">
          <label>Product Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. CRM Software"
            style={errors.name ? { borderColor: 'var(--danger)' } : {}}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label>Type</label>
          <input name="type" value={form.type} onChange={handleChange} placeholder="e.g. SaaS, Hardware" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Sales Price (₹) *</label>
            <input
              name="sales_price"
              type="number"
              step="0.01"
              value={form.sales_price}
              onChange={handleChange}
              placeholder="0.00"
              style={errors.sales_price ? { borderColor: 'var(--danger)' } : {}}
            />
            {errors.sales_price && <span className="field-error">{errors.sales_price}</span>}
          </div>
          <div className="form-group">
            <label>Cost Price (₹)</label>
            <input name="cost_price" type="number" step="0.01" value={form.cost_price} onChange={handleChange} placeholder="0.00" />
          </div>
        </div>

        <div className="form-group">
          <label>Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Optional notes..." rows={3} />
        </div>

        <div className="form-check">
          <input type="checkbox" id="is_active" name="is_active" checked={!!form.is_active} onChange={handleChange} />
          <label htmlFor="is_active">Active</label>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner spinner-sm" /> Saving...</> : isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
