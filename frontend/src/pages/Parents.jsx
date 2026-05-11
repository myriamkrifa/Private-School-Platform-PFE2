import { useEffect, useState } from 'react'
import { getAllUsers } from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

export default function Parents() {
  const [parents, setParents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchParents = async () => {
      try {
        const res = await getAllUsers()
        const accounts = res.data.users || []
        setParents(accounts.filter((user) => user.role === 'PARENT'))
      } catch (error) {
        console.error('Error fetching parents:', error)
        setParents([])
      } finally {
        setLoading(false)
      }
    }

    fetchParents()
  }, [])

  return (
    <DashboardShell title="Parents" subtitle="Review parent accounts and their access to student information.">
      {loading ? (
        <div className="page-card"><p>Loading parents...</p></div>
      ) : parents.length === 0 ? (
        <div className="page-card"><p>No parents found.</p></div>
      ) : (
        <section className="page-card page-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((parent) => (
                <tr key={parent.id}>
                  <td>{parent.name}</td>
                  <td>{parent.email}</td>
                  <td>{parent.role}</td>
                  <td>{new Date(parent.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </DashboardShell>
  )
}