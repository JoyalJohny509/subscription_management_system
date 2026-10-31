export default function BrightloopLogo({ size = 'md', showSubtitle = true, className = '' }) {
  const sizeMap = {
    sm: { icon: 24, font: '1rem', sub: '0.65rem' },
    md: { icon: 30, font: '1.2rem', sub: '0.7rem' },
    lg: { icon: 38, font: '1.5rem', sub: '0.8rem' },
  }

  const s = sizeMap[size] || sizeMap.md

  return (
    <div className={`brightloop-brand ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="blLoopGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="blLoopGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="9" fill="url(#blLoopGrad1)" />
        {/* Continuous recurring loop motif */}
        <path
          d="M12 18C12 14.6863 14.6863 12 18 12C21.3137 12 24 14.6863 24 18C24 21.3137 21.3137 24 18 24"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="18" cy="18" r="2.2" fill="#38BDF8" />
        <path
          d="M20 9.5L24 13.5L20 17.5"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: s.font,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          >
            Brightloop
          </span>
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '2px 5px',
              borderRadius: '4px',
              background: 'var(--accent-subtle)',
              color: 'var(--accent-primary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              border: '1px solid var(--accent-border, rgba(99, 102, 241, 0.25))',
            }}
          >
            SMS
          </span>
        </div>
        {showSubtitle && (
          <span
            style={{
              fontSize: s.sub,
              color: 'var(--text-muted)',
              fontWeight: 500,
              letterSpacing: '0.01em',
              marginTop: '2px',
            }}
          >
            Subscription Engine
          </span>
        )}
      </div>
    </div>
  )
}
