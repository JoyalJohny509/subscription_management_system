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
    setErrors((errs) => ({ ...errs, [name]: '', api: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Full name is required'
    if (!form.email.trim()) {
      errs.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      errs.email = 'Please enter a valid email address'
    }

    if (!isEdit) {
      if (!form.password) {
        errs.password = 'Password is required for new users'
      } else if (form.password.length < 8) {
        errs.password = 'Password must be at least 8 characters long'
      } else if (!/[A-Z]/.test(form.password)) {
        errs.password = 'Password must include at least one uppercase letter (A-Z)'
      } else if (!/[a-z]/.test(form.password)) {
        errs.password = 'Password must include at least one lowercase letter (a-z)'
      } else if (!/[^A-Za-z0-9]/.test(form.password)) {
        errs.password = 'Password must include at least one special character (!@#$%...)'
      }
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setLoading(true)
    try {
      const payload = { name: form.name, email: form.email, role: form.role }
      if (!isEdit) payload.password = form.password
      await onSave(payload)
      onClose()
    } catch (err) {
      const serverMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' ? err.response?.data : null) ||
        'Failed to save user.'

      const newErrors = { api: serverMsg }
      const lower = serverMsg.toLowerCase()
      if (lower.includes('password')) {
        newErrors.password = serverMsg
      }
      if (lower.includes('email') || lower.includes('in use')) {
        newErrors.email = serverMsg
      }
      setErrors(newErrors)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit User' : 'Create Staff User'} size="md">
      <form onSubmit={handleSubmit}>
        {errors.api && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{errors.api}</div>}

        <div className="form-group">
          <label>Full Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="John Doe"
            style={errors.name ? { borderColor: 'var(--danger)' } : {}}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label>Email *</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="john@example.com"
            style={errors.email ? { borderColor: 'var(--danger)' } : {}}
          />
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
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              style={errors.password ? { borderColor: 'var(--danger)' } : {}}
            />
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
              Must be at least 8 characters with uppercase, lowercase, and a special character (!@#$...).
            </small>
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
