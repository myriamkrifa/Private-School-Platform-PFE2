import { useEffect, useState } from 'react'
import { getAllUsers } from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

export default function Teachers() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const res = await getAllUsers()
        const accounts = res.data.users || []
        setTeachers(accounts.filter((user) => user.role === 'TEACHER'))
      } catch (error) {
        console.error('Error fetching teachers:', error)
        setTeachers([])
      } finally {
        setLoading(false)
      }
    }
    fetchTeachers()
  }, [])

  return (
    <DashboardShell title="Teachers" subtitle="Review the staff roster and contact details.">

          {loading ? (
            <div className="page-card"><p>Loading teachers...</p></div>
          ) : teachers.length === 0 ? (
            <div className="page-card"><p>No teachers found.</p></div>
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
                  {teachers.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>{teacher.name}</td>
                      <td>{teacher.email}</td>
                      <td>{teacher.role}</td>
                      <td>{new Date(teacher.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
    </DashboardShell>
  )
}
