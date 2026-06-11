import { useEffect, useState } from 'react'
import { getAllUsers, approveUser } from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'
import { useCreateAccount } from '../context/CreateAccountContext'

function UsersContent() {
  const { createdVersion } = useCreateAccount()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchUsers = async () => {
    try {
      const res = await getAllUsers()
      setUsers(res.data.users || [])
    } catch (err) {
      console.error('Error fetching users:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [createdVersion])

  const handleApprove = async (userId) => {
    setApprovingId(userId)
    setError('')
    setSuccess('')
    try {
      const response = await approveUser(userId)
      await fetchUsers()
      const emailSent = response.data?.emailNotification?.sent
      setSuccess(
        emailSent
          ? 'User approved. A confirmation email was sent.'
          : 'User approved. (SMTP not configured — no email sent.)'
      )
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve user.')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <>
      {error ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

      {loading ? (
        <div className="page-card"><p>Loading users...</p></div>
      ) : users.length === 0 ? (
        <div className="page-card"><p>No users found.</p></div>
      ) : (
        <section className="page-card page-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <span className={u.isActive ? 'text-emerald-700' : 'text-amber-700'}>
                      {u.isActive ? 'Active' : 'Pending'}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    {!u.isActive ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm btn-inline"
                        disabled={approvingId === u.id}
                        onClick={() => handleApprove(u.id)}
                      >
                        {approvingId === u.id ? 'Approving...' : 'Approve'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

export default function Users() {
  return (
    <DashboardShell title="Users" subtitle="Manage users and review account roles.">
      <UsersContent />
    </DashboardShell>
  )
}
