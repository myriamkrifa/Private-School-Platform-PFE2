import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sidebarItemsByRole } from '../config/roleAccess'

export default function Sidebar() {
  const { user } = useAuth()
  const menuItems = sidebarItemsByRole[user?.role] || sidebarItemsByRole.STUDENT

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-icon">
              {typeof item.icon === 'function' ? (() => {
                const Icon = item.icon
                return <Icon size={16} />
              })() : item.icon}
            </span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
