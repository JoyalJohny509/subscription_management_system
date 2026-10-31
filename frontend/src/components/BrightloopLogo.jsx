export default function BrightloopLogo({ size = 'md', showSubtitle = true, className = '' }) {
  const sizeMap = {
    sm: { icon: 28, font: '1rem', badge: '0.575rem', sub: '0.625rem' },
    md: { icon: 34, font: '1.2rem', badge: '0.625rem', sub: '0.675rem' },
    lg: { icon: 44, font: '1.5rem', badge: '0.7rem', sub: '0.75rem' },
  }

  const s = sizeMap[size] || sizeMap.md

  return (
    <div
      className={`brightloop-brand ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'lg' ? '12px' : '10px',
        userSelect: 'none',
      }}
    >
      {/* Precision Dual-Loop Recurring Emblem */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(79, 70, 229, 0.15))' }}
      >
        <defs>
          {/* Outer Squircle Container Gradients */}
          <linearGradient id="blSquircleLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#EEF2FF" />
          </linearGradient>
          <linearGradient id="blSquircleDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          {/* Primary Ribbon Gradient — Electric Indigo into Royal Violet */}
          <linearGradient id="blRibbonIndigo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="50%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>

          {/* Secondary Ribbon Gradient — Luminous Cyan into Emerald Flow */}
          <linearGradient id="blRibbonCyan" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>

          {/* Core Pulse Glow */}
          <radialGradient id="blCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Squircle Housing with Hairline Border */}
        <rect
          x="1"
          y="1"
          width="42"
          height="42"
          rx="11"
          className="bl-logo-bg"
          stroke="url(#blRibbonIndigo)"
          strokeWidth="1.2"
          strokeOpacity="0.3"
        />

        {/* Ambient Core Glow */}
        <circle cx="22" cy="22" r="10" fill="url(#blCoreGlow)" />

        {/* Continuous Recurring Infinity Ribbon — Left Loop (Back layer) */}
        <path
          d="M22 22 C17.5 14 10.5 14 7.5 17.5 C4.5 21 5 26 8.5 28.5 C12 31 18 29.5 22 22 Z"
          stroke="url(#blRibbonIndigo)"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Continuous Recurring Infinity Ribbon — Right Loop (Front overlapping layer) */}
        <path
          d="M22 22 C26.5 30 33.5 30 36.5 26.5 C39.5 23 39 18 35.5 15.5 C32 13 26 14.5 22 22 Z"
          stroke="url(#blRibbonCyan)"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Center Interlocking Spark Node */}
        <circle cx="22" cy="22" r="2.4" fill="#FFFFFF" />
        <circle cx="22" cy="22" r="3.6" stroke="#4F46E5" strokeWidth="1" strokeOpacity="0.5" />
      </svg>

      {/* Brand Typography */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span
            style={{
              fontSize: s.font,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <span style={{ color: 'var(--text-primary)' }}>Bright</span>
            <span
              style={{
                background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              loop
            </span>
          </span>

          <span
            style={{
              fontSize: s.badge,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '5px',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
              color: 'var(--accent-primary)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              border: '1px solid rgba(79, 70, 229, 0.22)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
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
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginTop: '3px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Subscription Engine
          </span>
        )}
      </div>
    </div>
  )
}
