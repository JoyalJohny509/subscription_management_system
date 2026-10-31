export default function StatCard({ icon, label, value, color, subtitle }) {
  const iconBg = {
    indigo: 'rgba(99,102,241,0.15)',
    green: 'rgba(16,185,129,0.15)',
    amber: 'rgba(245,158,11,0.15)',
    red: 'rgba(244,63,94,0.15)',
    blue: 'rgba(56,189,248,0.15)',
  }

  const iconColor = {
    indigo: 'var(--accent-primary)',
    green: 'var(--success)',
    amber: 'var(--warning)',
    red: 'var(--danger)',
    blue: 'var(--info)',
  }

  return (
    <div className="stat-card">
      <div
        className="stat-icon"
        style={{
          background: iconBg[color] || iconBg.indigo,
          color: iconColor[color] || iconColor.indigo,
        }}
      >
        {icon}
      </div>
      <div className="stat-info">
        <div className="value">{value}</div>
        <div className="label">{label}</div>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
    </div>
  )
}
