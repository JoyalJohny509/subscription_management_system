import { useState, useEffect } from 'react'
import Modal from './Modal'
import { getUpiQrCode, processWebhook } from '../api/payments'
import { useToast } from '../context/ToastContext'
import { ShieldCheck, CheckCircle2, Sparkles, QrCode } from 'lucide-react'

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
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Generating secure dynamic UPI QR code...
            </div>
          </div>
        ) : error ? (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success)', letterSpacing: '-0.02em' }}>
                {fmt(qrData?.amount || invoice.grand_total)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <ShieldCheck size={14} color="var(--success)" />
                <span>Verified Payee: Brightloop Software Pvt Ltd (brightloop@upi)</span>
              </div>
            </div>

            {(qrData?.qr_code || qrData?.qrCodeDataUrl) && (
              <div
                style={{
                  display: 'inline-block',
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                  marginBottom: '16px',
                }}
              >
                <img
                  src={qrData.qr_code || qrData.qrCodeDataUrl}
                  alt="UPI Payment QR Code"
                  style={{ width: '210px', maxWidth: '100%', height: 'auto', margin: '0 auto', display: 'block' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span className="badge badge-active" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>Google Pay</span>
              <span className="badge badge-active" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>PhonePe</span>
              <span className="badge badge-active" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>Paytm</span>
              <span className="badge badge-active" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>BHIM UPI</span>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 16px' }}>
              Scan this dynamic QR code using any UPI banking app for instant account settlement.
            </p>

            {/* Test Simulation Panel */}
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: 16,
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} color="var(--accent-primary)" />
                <span>SANDBOX SETTLEMENT SIMULATOR</span>
              </div>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleSimulatePayment}
                disabled={simulating}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {simulating ? 'Processing Settlement...' : 'Simulate Instant Payment Settlement'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
