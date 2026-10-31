import { useState } from 'react'
import Modal from '../../components/Modal'

export default function UserForm({ isOpen, onClose, onSave, initialData }) {
  const isEdit = !!initialData

  const [form, setForm] = useState(
    initialData || { name: '', email: '', role: 'staff', password: '' }
  )
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((errs) => ({ ...errs, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    if (!isEdit && !form.password) errs.password = 'Password is required for new users'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const payload = { name: form.name, email: form.email, role: form.role }
      if (!isEdit) payload.password = form.password
      await onSave(payload)
      onClose()
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save user.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit User' : 'Create Staff User'} size="md">
      <form onSubmit={handleSubmit}>
        {errors.api && <div className="alert alert-error">{errors.api}</div>}

        <div className="form-group">
          <label>Full Name *</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="John Doe" />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label>Email *</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="john@example.com" />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label>Role</label>
          <select name="role" value={form.role} onChange={handleChange}>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="customer">Customer</option>
          </select>
        </div>

        {!isEdit && (
          <div className="form-group">
            <label>Password *</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner spinner-sm" /> Saving...</> : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
