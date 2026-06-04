import { useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { CreateAccountProvider, useCreateAccount } from '../context/CreateAccountContext'
import { groupNavItemsBySection, navigationItemsByRole } from '../config/roleAccess'

function SidebarAddButton({ createType, onClick }) {
  const isStudent = createType === 'STUDENT'
  return (
    <button
      type="button"
      className={`sidebar-add-btn ${isStudent ? 'sidebar-add-btn--blue' : 'sidebar-add-btn--orange'}`}
      title={isStudent ? 'Create student' : 'Create teacher'}
      aria-label={isStudent ? 'Create student' : 'Create teacher'}
      onClick={onClick}
    >
      +
    </button>
  )
}

function DashboardShellContent({ title, subtitle, children }) {
  const { user, logout } = useAuth()
  const { openCreateModal } = useCreateAccount()
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
              <p className="font-semibold leading-none text-slate-900">Private School</p>
              <p className="text-xs text-slate-500">ERP Platform</p>
            </div>
          </div>

          <nav className="erp-sidebar-nav flex-1 overflow-y-auto">
            {navSections.map(({ section, items }) => (
              <div key={section} className="erp-sidebar-section">
                <p className="erp-sidebar-section-title">{section}</p>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon
                    const accent = item.accent || 'neutral'
                    const showCreateButton = isAdmin && item.createType

                    return (
                      <li key={item.path}>
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
                  })}
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
                  aria-label="Notifications"
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Bell size={18} />
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

          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
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
