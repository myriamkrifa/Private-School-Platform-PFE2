import { useAuth } from '../context/AuthContext'
import DashboardShell from '../components/DashboardShell'

export default function Profile() {
  const { user } = useAuth()

  return (
    <DashboardShell title="Profile" subtitle="View and manage your profile information.">
      <section className="page-card">
        <div className="page-row">
          <span className="page-label">Full Name</span>
          <strong>{user?.name || 'N/A'}</strong>
        </div>
        <div className="page-row">
          <span className="page-label">Email</span>
          <strong>{user?.email || 'N/A'}</strong>
        </div>
        <div className="page-row">
          <span className="page-label">Role</span>
          <strong>{user?.role?.toLowerCase() || 'user'}</strong>
        </div>
        <div className="page-row">
          <span className="page-label">Status</span>
          <strong>Active</strong>
        </div>
      </section>
    </DashboardShell>
  )
}
