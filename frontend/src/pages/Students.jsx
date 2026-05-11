import { useEffect, useState } from 'react'
import { getAllUsers } from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await getAllUsers()
        const accounts = res.data.users || []
        setStudents(accounts.filter((user) => user.role === 'STUDENT'))
      } catch (error) {
        console.error('Error fetching students:', error)
        setStudents([])
      } finally {
        setLoading(false)
      }
    }
    fetchStudents()
  }, [])

  return (
    <DashboardShell title="Students" subtitle="Browse the student list and monitor their status.">

          {loading ? (
            <div className="page-card"><p>Loading students...</p></div>
          ) : students.length === 0 ? (
            <div className="page-card"><p>No students found.</p></div>
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
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.role}</td>
                      <td>{new Date(student.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
    </DashboardShell>
  )
}
