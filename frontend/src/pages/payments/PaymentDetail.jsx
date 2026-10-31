import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPaymentById } from '../../api/payments'
import Badge from '../../components/Badge'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function PaymentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getPaymentById(id)
      .then((res) => setPayment(res.data.data || res.data))
      .catch((err) => setError(err.response?.data?.error || 'Payment not found.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="spinner" style={{ margin: '40px auto' }} />
  if (error || !payment) return <div className="alert alert-danger">{error || 'Payment not found'}</div>

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/payments')} style={{ marginBottom: 16 }}>
        ← Back to Payments
      </button>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Payment #{payment.id}</h2>
          <Badge status={payment.status} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Invoice: </span>
            <a
              href={`/invoices/${payment.invoice_id}`}
              onClick={(e) => { e.preventDefault(); navigate(`/invoices/${payment.invoice_id}`) }}
              style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
            >
              {payment.invoice_number || `INV-${payment.invoice_id}`}
            </a>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Customer: </span>
            <strong>{payment.customer_name || 'N/A'}</strong> ({payment.company_name})
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Amount Paid: </span>
            <strong style={{ fontSize: '1.2rem', color: 'var(--success)' }}>{fmt(payment.amount)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Method: </span>
            <span style={{ textTransform: 'uppercase' }}>{payment.method}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Date: </span>
            {payment.payment_date}
          </div>
          {payment.notes && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Reference / Notes: </span>
              {payment.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
