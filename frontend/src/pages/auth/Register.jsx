import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerApi } from '../../api/auth'

function getStrength(password) {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    company_name: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const strength = getStrength(form.password)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((errs) => ({ ...errs, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email'
    if (!form.password) errs.password = 'Password is required'
    else if (form.password.length < 8) errs.password = 'Min 8 characters'
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Needs uppercase letter'
    else if (!/[a-z]/.test(form.password)) errs.password = 'Needs lowercase letter'
    else if (!/[^A-Za-z0-9]/.test(form.password)) errs.password = 'Needs special character'
    if (!form.confirmPassword) errs.confirmPassword = 'Please confirm password'
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setApiError('')
    try {
      await registerApi({
        name: form.name,
        email: form.email,
        company_name: form.company_name,
        phone: form.phone,
        password: form.password,
      })
      navigate('/login')
    } catch (err) {
      setApiError(err.response?.data?.error || err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px', height: '48px', background: 'var(--accent-primary)',
              borderRadius: '12px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 12px',
            }}
          >
            ⚡
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Create Account
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.875rem' }}>
            Join Brightloop SMS as a customer
          </p>
        </div>

        <div className="card">
          {apiError && <div className="alert alert-error">{apiError}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
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
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Company Name</label>
                <input name="company_name" value={form.company_name} onChange={handleChange} placeholder="Acme Inc." />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
              </div>
            </div>

            <div className="form-group">
              <label>Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min 8 chars, uppercase, lowercase, special"
                  style={{ paddingRight: '42px', width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '1rem',
                    padding: '4px',
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {form.password && (
                <>
                  <div className="password-strength">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`strength-bar ${i <= strength ? `filled-${strength}` : ''}`}
                      />
                    ))}
                  </div>
                  <div className="strength-label">
                    {STRENGTH_LABELS[strength]}
                  </div>
                </>
              )}
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label>Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  style={{ paddingRight: '42px', width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '1rem',
                    padding: '4px',
                  }}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '8px' }}
            >
              {loading ? <><span className="spinner spinner-sm" /> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
