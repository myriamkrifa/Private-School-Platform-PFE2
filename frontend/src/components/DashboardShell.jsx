import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Bell, ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { CreateAccountProvider, useCreateAccount } from '../context/CreateAccountContext'
import { useNotifications } from '../context/NotificationContext'
import { groupNavItemsBySection, navigationItemsByRole } from '../config/roleAccess'

function SidebarAddButton({ createType, onClick }) {
  const isStudent = createType === 'STUDENT'
  return (
    <button
      type="button"
      className="sidebar-add-btn sidebar-add-btn--blue"
      title={isStudent ? 'Create student' : 'Create teacher'}
      aria-label={isStudent ? 'Create student' : 'Create teacher'}
      onClick={onClick}
    >
      +
    </button>
  )
}

function SidebarNavLink({ item, isAdmin, openCreateModal }) {
  const Icon = item.icon
  const accent = item.accent || 'neutral'
  const showCreateButton = isAdmin && item.createType

  return (
    <li>
      <div className={`erp-sidebar-row erp-sidebar-row--${accent}`}>
        <NavLink
          to={item.path}
          className={({ isActive }) =>
            `erp-sidebar-link ${isActive ? 'is-active' : ''} erp-sidebar-link--${accent}`
          }
        >
          <span className={`erp-sidebar-icon erp-sidebar-icon--${accent}`}>
            <Icon size={18} strokeWidth={2} />
          </span>
          <span className="truncate">{item.label}</span>
        </NavLink>
        {showCreateButton ? (
          <SidebarAddButton
            createType={item.createType}
            onClick={() => openCreateModal(item.createType)}
          />
        ) : null}
      </div>
    </li>
  )
}

function SidebarNavGroup({ item }) {
  const location = useLocation()
  const navigate = useNavigate()
  const Icon = item.icon
  const accent = item.accent || 'neutral'
  const children = item.children || []

  const isChildActive = useMemo(
    () => children.some((child) => location.pathname === child.path),
    [children, location.pathname]
  )

  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isChildActive) {
      setOpen(true)
    }
  }, [isChildActive])

  const handleToggle = () => {
    setOpen((value) => {
      const next = !value
      if (next && item.path && !isChildActive) {
        navigate(item.path)
      }
      return next
    })
  }

  return (
    <li className="erp-sidebar-nav-group">
      <div className={`erp-sidebar-group-box${open ? ' is-open' : ''}${isChildActive ? ' has-active-child' : ''}`}>
        <button
          type="button"
          className={`erp-sidebar-link erp-sidebar-link--group erp-sidebar-link--${accent}${open ? ' is-expanded' : ''}`}
          onClick={handleToggle}
          aria-expanded={open}
          aria-controls={`sidebar-group-${item.label}`}
        >
          <span className={`erp-sidebar-icon erp-sidebar-icon--${accent}`}>
            <Icon size={18} strokeWidth={2} />
          </span>
          <span className="erp-sidebar-group-label truncate">{item.label}</span>
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={`erp-sidebar-chevron${open ? ' is-open' : ''}`}
            aria-hidden
          />
        </button>

        {open ? (
          <div id={`sidebar-group-${item.label}`} className="erp-sidebar-subnav-wrap is-open">
            <ul className="erp-sidebar-subnav">
              {children.map((child) => {
                const ChildIcon = child.icon
                const childAccent = child.accent || accent

                return (
                  <li key={child.path}>
                    <NavLink
                      to={child.path}
                      className={({ isActive }) =>
                        `erp-sidebar-sublink ${isActive ? 'is-active' : ''} erp-sidebar-sublink--${childAccent}`
                      }
                    >
                      <span className={`erp-sidebar-icon erp-sidebar-icon--${childAccent}`}>
                        <ChildIcon size={16} strokeWidth={2} />
                      </span>
                      <span className="truncate">{child.label}</span>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </li>
  )
}

function DashboardShellContent({ title, subtitle, children }) {
  const { user, logout } = useAuth()
  const { openCreateModal } = useCreateAccount()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const isAdmin = user?.role === 'ADMIN'

  const navItems = (navigationItemsByRole[user?.role] || navigationItemsByRole.STUDENT).filter(
    (item) => item.label !== 'Notifications'
  )
  const navSections = useMemo(() => groupNavItemsBySection(navItems), [navItems])

  const initials = useMemo(() => {
    return user?.name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  }, [user?.name])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="erp-sidebar hidden md:flex md:flex-col">
          <div className="erp-sidebar-brand">
            <div className="erp-sidebar-logo">PS</div>
            <div>
              <p className="erp-sidebar-brand-title">Private School</p>
              <p className="erp-sidebar-brand-subtitle">ERP Platform</p>
            </div>
          </div>

          <nav className="erp-sidebar-nav flex-1 overflow-y-auto">
            {navSections.map(({ section, items }) => (
              <div key={section} className="erp-sidebar-section">
                <p className="erp-sidebar-section-title">{section}</p>
                <ul className="space-y-1">
                  {items.map((item) =>
                    item.children?.length ? (
                      <SidebarNavGroup key={item.label} item={item} />
                    ) : (
                      <SidebarNavLink
                        key={item.path}
                        item={item}
                        isAdmin={isAdmin}
                        openCreateModal={openCreateModal}
                      />
                    )
                  )}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="text-xs text-slate-500">{subtitle || `Signed in as ${user?.role || 'USER'}`}</p>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <NavLink
                  to="/notifications"
                  aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Bell size={18} />
                  {unreadCount > 0 ? (
                    <span className="notification-badge" aria-hidden>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </NavLink>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileOpen((prev) => !prev)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 hover:bg-slate-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-[#e97828] text-xs font-semibold text-white">
                      {initials}
                    </span>
                    <span className="hidden text-sm font-medium md:block">{user?.name || 'User'}</span>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                      <div className="border-b border-slate-100 px-2 py-2">
                        <p className="text-sm font-medium">{user?.name}</p>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}

export default function DashboardShell(props) {
  return (
    <CreateAccountProvider>
      <DashboardShellContent {...props} />
    </CreateAccountProvider>
  )
}
