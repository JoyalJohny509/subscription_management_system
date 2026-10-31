import { useState } from 'react'
import Modal from '../../components/Modal'

export default function DiscountForm({ isOpen, onClose, onSave, initialData }) {
  const isEdit = !!initialData
  const [form, setForm] = useState(
    initialData
      ? { ...initialData }
      : {
          code: '',
          name: '',
          type: 'percentage',
          value: '',
          min_amount: 0,
          min_qty: 1,
          start_date: '',
          end_date: '',
          max_uses: '',
          applicable_to: 'all',
          is_active: 1,
        }
  )
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? (checked ? 1 : 0) : value }))
    setErrors((errs) => ({ ...errs, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.code.trim()) errs.code = 'Discount code is required'
    if (!form.name.trim()) errs.name = 'Discount name is required'
    if (!form.value || parseFloat(form.value) <= 0) errs.value = 'Valid value is required'
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
        value: parseFloat(form.value) || 0,
        min_amount: parseFloat(form.min_amount) || 0,
        min_qty: parseInt(form.min_qty) || 1,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      })
      onClose()
    } catch (err) {
      setErrors({ form: err.response?.data?.error || 'Failed to save discount rule' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Discount Rule' : 'Create Discount Rule'}
    >
      <form onSubmit={handleSubmit}>
        {errors.form && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{errors.form}</div>}

        <div className="grid-2">
          <div className="form-group">
            <label>Coupon Code *</label>
            <input
              type="text"
              name="code"
              placeholder="e.g. WELCOME10"
              value={form.code}
              onChange={handleChange}
              disabled={isEdit}
              required
            />
            {errors.code && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{errors.code}</span>}
          </div>

          <div className="form-group">
            <label>Rule Name *</label>
            <input
              type="text"
              name="name"
              placeholder="e.g. 10% Welcome Discount"
              value={form.name}
              onChange={handleChange}
              required
            />
            {errors.name && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{errors.name}</span>}
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Discount Type *</label>
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Discount Value ({form.type === 'percentage' ? '%' : '₹'}) *</label>
            <input
              type="number"
              step="0.01"
              name="value"
              value={form.value}
              onChange={handleChange}
              required
            />
            {errors.value && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{errors.value}</span>}
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Minimum Purchase Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              name="min_amount"
              value={form.min_amount}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Max Uses (Usage Limit)</label>
            <input
              type="number"
              name="max_uses"
              placeholder="Unlimited if empty"
              value={form.max_uses || ''}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              name="start_date"
              value={form.start_date || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              name="end_date"
              value={form.end_date || ''}
              onChange={handleChange}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Rule' : 'Create Discount'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
