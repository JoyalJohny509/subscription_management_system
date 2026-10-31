import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login as loginApi } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await loginApi(form)
      const data = res.data.data || res.data
      const { token, user } = data
      login(user, token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please check your credentials.')
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
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              background: 'var(--accent-primary)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              margin: '0 auto 16px',
            }}
          >
            ⚡
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Brightloop SMS
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '0.875rem' }}>
            Subscription Management System
          </p>
        </div>

        {/* Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '24px', color: 'var(--text-primary)' }}>
            Sign in to your account
          </h2>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
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
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {loading ? (
                <>
                  <span className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div
            style={{
              textAlign: 'center',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border)',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
            }}
          >
            Don't have an account?{' '}
            <Link to="/register">Create one</Link>
          </div>
        </div>

        {/* Demo credentials */}
        <div
          style={{
            marginTop: '20px',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '10px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent-primary)', marginBottom: '8px' }}>
            🔑 Demo Credentials
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Admin:</strong> admin@brightloop.com / Admin@1234
          </div>
        </div>
      </div>
    </div>
  )
}
