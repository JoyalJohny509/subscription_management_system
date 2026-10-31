import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import BrightloopLogo from './BrightloopLogo'
import {
  LayoutDashboard,
  Building2,
  Users,
  Package,
  Layers,
  FileText,
  Repeat,
  Receipt,
  Percent,
  CreditCard,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react'

const navItems = [
  { Icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['admin', 'staff'] },
  { Icon: Building2, label: 'Client Portal', path: '/portal', roles: ['customer'] },
  { Icon: Users, label: 'Users & Staff', path: '/users', roles: ['admin'] },
  { Icon: Package, label: 'Products', path: '/products', roles: ['admin', 'staff'] },
  { Icon: Layers, label: 'Billing Plans', path: '/plans', roles: ['admin', 'staff'] },
  { Icon: FileText, label: 'Quotations', path: '/quotations', roles: ['admin', 'staff'] },
  { Icon: Repeat, label: 'Subscriptions', path: '/subscriptions', roles: ['admin', 'staff', 'customer'] },
  { Icon: Receipt, label: 'Invoices', path: '/invoices', roles: ['admin', 'staff', 'customer'] },
  { Icon: Percent, label: 'Discounts', path: '/discounts', roles: ['admin', 'staff'] },
  { Icon: CreditCard, label: 'Payments', path: '/payments', roles: ['admin', 'staff', 'customer'] },
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
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <BrightloopLogo size="md" />
        <button
          className="mobile-menu-btn"
          onClick={onClose}
          aria-label="Close menu"
          style={{ padding: '6px' }}
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Operations</div>
        {visibleItems.map(({ Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon size={18} strokeWidth={2} />
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name || 'User'}</div>
            <div className="user-role-badge">
              <span className="role-dot" />
              {user?.role || 'Guest'}
            </div>
          </div>
        </div>
        <button
          className="btn btn-secondary w-full btn-sm btn-logout"
          onClick={handleLogout}
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

function Topbar({ title, onToggleMobile }) {
  const { user } = useAuth()
  const { theme, toggleTheme, isDark } = useTheme()
  const location = useLocation()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="mobile-menu-btn"
          onClick={onToggleMobile}
          title="Toggle Navigation"
          aria-label="Toggle Navigation"
        >
          <Menu size={20} />
        </button>
        <div className="topbar-breadcrumb">
          <span className="topbar-breadcrumb-root">Brightloop</span>
          <span className="topbar-breadcrumb-separator">/</span>
          <h1 className="topbar-title">{title || 'Dashboard'}</h1>
        </div>
      </div>

      <div className="topbar-right">
        {/* Theme Mode Toggle Button */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="topbar-user-pill">
          <div className="topbar-user-avatar">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="topbar-user-meta">
            <span className="topbar-user-name">{user?.name}</span>
            <span className="topbar-user-role">{user?.role}</span>
          </div>
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
