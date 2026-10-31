import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { icon: '📊', label: 'Dashboard', path: '/dashboard', roles: ['admin', 'staff'] },
  { icon: '🏠', label: 'Client Portal', path: '/portal', roles: ['customer'] },
  { icon: '👥', label: 'Users', path: '/users', roles: ['admin'] },
  { icon: '📦', label: 'Products', path: '/products', roles: ['admin', 'staff'] },
  { icon: '📋', label: 'Plans', path: '/plans', roles: ['admin', 'staff'] },
  { icon: '📄', label: 'Quotations', path: '/quotations', roles: ['admin', 'staff'] },
  { icon: '🔄', label: 'Subscriptions', path: '/subscriptions', roles: ['admin', 'staff', 'customer'] },
  { icon: '🧾', label: 'Invoices', path: '/invoices', roles: ['admin', 'staff', 'customer'] },
  { icon: '🏷️', label: 'Discounts', path: '/discounts', roles: ['admin', 'staff'] },
  { icon: '💳', label: 'Payments', path: '/payments', roles: ['admin', 'staff', 'customer'] },
]

function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  )

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="logo-title">
            <div className="logo-icon">⚡</div>
            <span>Brightloop</span>
          </div>
          <div className="logo-subtitle">Subscription Management</div>
        </div>
        <button
          className="mobile-menu-btn"
          onClick={onClose}
          style={{ fontSize: '1.2rem', padding: '4px' }}
        >
          ✕
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Navigation</div>
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name || 'User'}</div>
            <div className="user-role" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
              {user?.role || 'guest'}
            </div>
          </div>
        </div>
        <button className="btn btn-secondary w-full btn-sm" onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>
    </aside>
  )
}

function Topbar({ title, onToggleMobile }) {
  const { user } = useAuth()
  return (
    <header className="topbar">
      <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="mobile-menu-btn" onClick={onToggleMobile} title="Toggle Navigation">
          ☰
        </button>
        <span className="topbar-title">{title || 'Brightloop SMS'}</span>
      </div>
      <div className="topbar-right">
        <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-active" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
            {user?.role}
          </span>
          <span className="topbar-user-name" style={{ color: 'var(--text-secondary)' }}>
            {user?.email}
          </span>
        </div>
      </div>
    </header>
  )
}

export default function Layout({ children, title }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="layout">
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'active' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <Sidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="main-content">
        <Topbar title={title} onToggleMobile={() => setMobileOpen((prev) => !prev)} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
