import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { icon: '📊', label: 'Dashboard', path: '/dashboard', roles: ['admin', 'staff'] },
  { icon: '👥', label: 'Users', path: '/users', roles: ['admin'] },
  { icon: '📦', label: 'Products', path: '/products', roles: ['admin', 'staff'] },
  { icon: '📋', label: 'Plans', path: '/plans', roles: ['admin', 'staff'] },
  { icon: '📄', label: 'Quotations', path: '/quotations', roles: ['admin', 'staff'] },
  { icon: '🔄', label: 'Subscriptions', path: '/subscriptions', roles: ['admin', 'staff', 'customer'] },
  { icon: '🧾', label: 'Invoices', path: '/invoices', roles: ['admin', 'staff', 'customer'] },
  { icon: '🏷️', label: 'Discounts', path: '/discounts', roles: ['admin', 'staff'] },
  { icon: '💳', label: 'Payments', path: '/payments', roles: ['admin', 'staff', 'customer'] },
]

function Sidebar() {
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
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-title">
          <div className="logo-icon">⚡</div>
          <span>Brightloop</span>
        </div>
        <div className="logo-subtitle">Subscription Management</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Navigation</div>
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
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
            <div className="user-role">{user?.role || 'guest'}</div>
          </div>
        </div>
        <button className="btn btn-secondary w-full btn-sm" onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>
    </aside>
  )
}

function Topbar({ title }) {
  const { user } = useAuth()
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">{title || 'Brightloop SMS'}</span>
      </div>
      <div className="topbar-right">
        <div className="topbar-user">
          <span className="topbar-user-name">{user?.email}</span>
        </div>
      </div>
    </header>
  )
}

export default function Layout({ children, title }) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title={title} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
