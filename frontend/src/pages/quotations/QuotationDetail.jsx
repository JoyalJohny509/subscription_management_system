import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getQuotationById, sendQuotation, acceptQuotation, rejectQuotation } from '../../api/quotations'
import { useAuth } from '../../context/AuthContext'
import Badge from '../../components/Badge'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isStaff, isAdmin } = useAuth()
  const [quotation, setQuotation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const fetchQuotation = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getQuotationById(id)
      setQuotation(res.data.data || res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load quotation.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchQuotation() }, [id])

  const handleSend = async () => {
    try {
      await sendQuotation(id)
      setActionSuccess('Quotation sent to customer!')
      fetchQuotation()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send.')
    }
  }

  const handleAccept = async () => {
    try {
      const res = await acceptQuotation(id)
      const subId = res.data.subscription?.id || res.data.data?.subscription?.id
      setActionSuccess('Quotation accepted and converted to subscription!')
      if (subId) {
        setTimeout(() => navigate(`/subscriptions/${subId}`), 1500)
      } else {
        fetchQuotation()
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept quotation.')
    }
  }

  const handleReject = async () => {
    if (!window.confirm('Reject this quotation?')) return
    try {
      await rejectQuotation(id)
      setActionSuccess('Quotation marked as rejected.')
      fetchQuotation()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject quotation.')
    }
  }

  if (loading) return <div className="spinner" style={{ margin: '40px auto' }} />
  if (error || !quotation) return <div className="alert alert-danger">{error || 'Quotation not found'}</div>

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/quotations')} style={{ marginBottom: 8 }}>
            ← Back to Quotations
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>
              {quotation.quotation_number || `QUO-${String(quotation.id).padStart(4, '0')}`}
            </h2>
            <Badge status={quotation.status} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            🖨️ Print
          </button>
          {isStaff() && quotation.status === 'draft' && (
            <>
              <button className="btn btn-secondary" onClick={() => navigate(`/quotations/${id}/edit`)}>
                ✏️ Edit
              </button>
              <button className="btn btn-primary" onClick={handleSend}>
                Send to Customer
              </button>
            </>
          )}
          {isStaff() && quotation.status === 'sent' && (
            <>
              <button className="btn btn-success" onClick={handleAccept}>
                ✓ Accept & Convert to Subscription
              </button>
              <button className="btn btn-danger" onClick={handleReject}>
                ✕ Reject
              </button>
            </>
          )}
        </div>
      </div>

      {actionSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>{actionSuccess}</div>}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>Customer Details</h4>
          <p style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 600 }}>
            {quotation.customer_name || 'N/A'}
          </p>
          {quotation.company_name && (
            <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
              Company: {quotation.company_name}
            </p>
          )}
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>Quotation Terms</h4>
          <p style={{ margin: '4px 0' }}>
            Validity: <strong>{quotation.validity_days || 30} days</strong>
          </p>
          <p style={{ margin: '4px 0' }}>
            Date Created: {quotation.created_at ? new Date(quotation.created_at).toLocaleDateString('en-IN') : '-'}
          </p>
          {quotation.notes && (
            <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
              Notes: {quotation.notes}
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Items & Pricing</h3>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Item #</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Tax %</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(quotation.lines || []).map((line, idx) => (
              <tr key={line.id || idx}>
                <td>Product #{line.product_id}</td>
                <td>{line.qty}</td>
                <td>{fmt(line.unit_price)}</td>
                <td>{line.tax_pct}%</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
          }}
        >
          <div>Subtotal: <strong>{fmt(quotation.subtotal)}</strong></div>
          <div>Tax Total: <strong>{fmt(quotation.tax_total)}</strong></div>
          <div style={{ fontSize: '1.3rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
            Grand Total: {fmt(quotation.grand_total)}
          </div>
        </div>
      </div>
    </div>
  )
}
