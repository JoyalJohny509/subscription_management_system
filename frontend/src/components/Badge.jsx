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

export default function Badge({ status }) {
  const cls = STATUS_MAP[status?.toLowerCase()] || 'badge-draft'
  return <span className={`badge ${cls}`}>{status || '—'}</span>
}
