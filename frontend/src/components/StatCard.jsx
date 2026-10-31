export default function StatCard({ icon, label, value, color = 'indigo', subtitle, trend }) {
  const colorMap = {
    indigo: {
      bg: 'rgba(99, 102, 241, 0.12)',
      border: 'rgba(99, 102, 241, 0.25)',
      glow: 'rgba(99, 102, 241, 0.35)',
      text: 'var(--accent-primary)',
      accent: '#6366F1',
    },
    green: {
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
      glow: 'rgba(16, 185, 129, 0.35)',
      text: 'var(--success)',
      accent: '#10B981',
    },
    amber: {
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.25)',
      glow: 'rgba(245, 158, 11, 0.35)',
      text: 'var(--warning)',
      accent: '#F59E0B',
    },
    red: {
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.25)',
      glow: 'rgba(239, 68, 68, 0.35)',
      text: 'var(--danger)',
      accent: '#EF4444',
    },
    blue: {
      bg: 'rgba(14, 165, 233, 0.12)',
      border: 'rgba(14, 165, 233, 0.25)',
      glow: 'rgba(14, 165, 233, 0.35)',
      text: 'var(--info)',
      accent: '#0EA5E9',
    },
  }

  const c = colorMap[color] || colorMap.indigo

  return (
    <div className="stat-card" style={{ '--card-accent': c.accent }}>
      <div
        className="stat-icon"
        style={{
          background: c.bg,
          color: c.text,
          borderColor: c.border,
          boxShadow: `0 0 16px -4px ${c.glow}`,
        }}
      >
        {icon}
      </div>
      <div className="stat-info">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div className="value">{value}</div>
          {trend && (
            <span
              className="stat-trend"
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: c.text,
                background: c.bg,
                border: `1px solid ${c.border}`,
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              {trend}
            </span>
          )}
        </div>
        <div className="label">{label}</div>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
    </div>
  )
}
