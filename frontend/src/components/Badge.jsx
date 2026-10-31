const STATUS_MAP = {
  draft: 'badge-draft',
  sent: 'badge-sent',
  accepted: 'badge-accepted',
  rejected: 'badge-rejected',
  confirmed: 'badge-confirmed',
  active: 'badge-active',
  paused: 'badge-paused',
  closed: 'badge-closed',
  paid: 'badge-paid',
  cancelled: 'badge-cancelled',
  pending: 'badge-pending',
  completed: 'badge-completed',
  overdue: 'badge-overdue',
  admin: 'badge-admin',
  staff: 'badge-staff',
  customer: 'badge-customer',
  fixed: 'badge-fixed',
  percentage: 'badge-percentage',
}

export default function Badge({ status, label, showDot = true, size = 'md' }) {
  const norm = String(status || '').toLowerCase()
  const cls = STATUS_MAP[norm] || 'badge-draft'
  const displayLabel = label || status || '—'

  return (
    <span className={`badge ${cls} badge-${size}`}>
      {showDot && <span className="badge-dot" />}
      <span className="badge-label">{displayLabel}</span>
    </span>
  )
}
