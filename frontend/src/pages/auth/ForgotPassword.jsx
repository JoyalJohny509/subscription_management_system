import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../api/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true)
    setError('')
    try {
      await forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.')
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
      <div style={{ width: '100%', maxWidth: '400px' }}>
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
            Forgot Password
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.875rem' }}>
            Enter your email to receive a reset code
          </p>
        </div>

        <div className="card">
          {sent ? (
            <div>
              <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                ✅ Password reset code sent! Check the server console for the reset code.
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
                The reset code has been logged to the server console (for development). In production, it would be sent to your email.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', display: 'flex' }}>
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                {loading ? <><span className="spinner spinner-sm" /> Sending...</> : 'Send Reset Code'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <Link to="/login">← Back to Login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
