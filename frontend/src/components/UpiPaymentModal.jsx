import { useState, useEffect } from 'react'
import Modal from './Modal'
import { getUpiQrCode, processWebhook } from '../api/payments'
import { useToast } from '../context/ToastContext'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function UpiPaymentModal({ isOpen, onClose, invoice, onPaymentSuccess }) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [qrData, setQrData] = useState(null)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && invoice) {
      setLoading(true)
      setError('')
      getUpiQrCode(invoice.id)
        .then((res) => {
          setQrData(res.data.data)
        })
        .catch((err) => {
          setError(err.response?.data?.error || 'Failed to generate UPI QR code.')
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, invoice])

  const handleSimulatePayment = async () => {
    if (!invoice) return
    setSimulating(true)
    setError('')
    try {
      const txnId = 'UPI-' + Math.floor(100000000 + Math.random() * 900000000)
      await processWebhook({
        invoice_id: invoice.id,
        amount: invoice.grand_total,
        method: 'upi',
        transaction_id: txnId,
        status: 'completed',
      })
      toast.success(`Payment of ${fmt(invoice.grand_total)} received via UPI!`)
      if (onPaymentSuccess) onPaymentSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process instant settlement.')
    } finally {
      setSimulating(false)
    }
  }

  if (!isOpen || !invoice) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`UPI Payment — ${invoice.invoice_number || `INV-${invoice.id}`}`}
    >
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: 'var(--text-secondary)' }}>Generating secure UPI QR code...</div>
          </div>
        ) : error ? (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)' }}>
                {fmt(qrData?.amount || invoice.grand_total)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Brightloop Software Pvt Ltd (brightloop@upi)
              </div>
            </div>

            {(qrData?.qr_code || qrData?.qrCodeDataUrl) && (
              <div
                style={{
                  display: 'inline-block',
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '16px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  marginBottom: '16px',
                }}
              >
                <img
                  src={qrData.qr_code || qrData.qrCodeDataUrl}
                  alt="UPI QR Code"
                  style={{ width: '220px', height: '220px', margin: '0 auto', display: 'block' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span className="badge badge-active">GPay</span>
              <span className="badge badge-active">PhonePe</span>
              <span className="badge badge-active">Paytm</span>
              <span className="badge badge-active">BHIM</span>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 20px' }}>
              Scan this QR code using any UPI app to make an instant settlement.
            </p>

            {/* Test Simulation Button */}
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                🧪 Development Sandbox / Testing Simulation
              </div>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleSimulatePayment}
                disabled={simulating}
                style={{ width: '100%' }}
              >
                {simulating ? 'Processing Settlement...' : '⚡ Simulate Instant UPI Payment'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
