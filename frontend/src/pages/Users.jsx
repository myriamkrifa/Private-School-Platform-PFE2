import { useEffect, useState } from 'react'
import {
  getAllUsers,
  provisionStudentWithParent,
  provisionTeacher
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [creationType, setCreationType] = useState('STUDENT')
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [form, setForm] = useState({
    studentFullName: '',
    studentEmail: '',
    parentName: '',
    parentIdentityCardNumber: '',
    parentPhoneNumber: '',
    teacherFullName: '',
    teacherEmail: ''
  })

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await getAllUsers()
        setUsers(res.data.users || [])
      } catch (error) {
        console.error('Error fetching users:', error)
        setUsers([])
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))
    setError('')
    setSuccess('')
    setCreatedCredentials(null)
  }

  const handleCreationTypeChange = (event) => {
    setCreationType(event.target.value)
    setError('')
    setSuccess('')
    setCreatedCredentials(null)
  }

  const handleCreateUser = async (event) => {
    event.preventDefault()

    setCreating(true)
    try {
      let response
      if (creationType === 'STUDENT') {
        if (
          !form.studentFullName.trim() ||
          !form.studentEmail.trim() ||
          !form.parentName.trim() ||
          !form.parentIdentityCardNumber.trim() ||
          !form.parentPhoneNumber.trim()
        ) {
          setError('Please fill in all student and parent fields.')
          setCreating(false)
          return
        }

        response = await provisionStudentWithParent({
          studentFullName: form.studentFullName.trim(),
          studentEmail: form.studentEmail.trim(),
          parentName: form.parentName.trim(),
          parentIdentityCardNumber: form.parentIdentityCardNumber.trim(),
          parentPhoneNumber: form.parentPhoneNumber.trim()
        })
      } else {
        if (!form.teacherFullName.trim() || !form.teacherEmail.trim()) {
          setError('Please fill in teacher full name and email.')
          setCreating(false)
          return
        }

        response = await provisionTeacher({
          teacherFullName: form.teacherFullName.trim(),
          teacherEmail: form.teacherEmail.trim()
        })
      }

      const refreshed = await getAllUsers()
      setUsers(refreshed.data.users || [])
      setForm({
        studentFullName: '',
        studentEmail: '',
        parentName: '',
        parentIdentityCardNumber: '',
        parentPhoneNumber: '',
        teacherFullName: '',
        teacherEmail: ''
      })
      setSuccess(response.data?.message || 'Account created successfully.')
      setCreatedCredentials(response.data?.credentials || null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create the account.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <DashboardShell title="Users" subtitle="Manage users and review account roles.">
      <section className="page-card mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Create Account</h2>
            <p className="text-sm text-slate-500">Open the modal to provision a student, teacher, or parent account.</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => setModalOpen(true)}
          >
            Create User
          </button>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Create Account</h3>
                <p className="text-sm text-slate-500">Admins can create a teacher account or a student account with an auto-linked parent.</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
                onClick={() => setModalOpen(false)}
                disabled={creating}
              >
                Close
              </button>
            </div>

            {error ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

            {createdCredentials ? (
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Generated credentials (show once)</p>
                {createdCredentials.student ? <p>Student: {createdCredentials.student.email} / {createdCredentials.student.password}</p> : null}
                {createdCredentials.parent && createdCredentials.parent.password ? (
                  <p>Parent (NEW): {createdCredentials.parent.email} / {createdCredentials.parent.password}</p>
                ) : createdCredentials.parent ? (
                  <p className="text-amber-700">Parent (LINKED to existing account): {createdCredentials.parent.email}</p>
                ) : null}
                {createdCredentials.teacher ? <p>Teacher: {createdCredentials.teacher.email} / {createdCredentials.teacher.password}</p> : null}
              </div>
            ) : null}

            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateUser}>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                name="creationType"
                value={creationType}
                onChange={handleCreationTypeChange}
              >
                <option value="STUDENT">Student + Parent</option>
                <option value="TEACHER">Teacher</option>
              </select>

              {creationType === 'STUDENT' ? (
                <>
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    name="studentFullName"
                    placeholder="Student full name"
                    value={form.studentFullName}
                    onChange={handleChange}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    name="studentEmail"
                    type="email"
                    placeholder="Student email"
                    value={form.studentEmail}
                    onChange={handleChange}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    name="parentName"
                    placeholder="Parent full name"
                    value={form.parentName}
                    onChange={handleChange}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    name="parentIdentityCardNumber"
                    placeholder="Parent identity card number"
                    value={form.parentIdentityCardNumber}
                    onChange={handleChange}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                    name="parentPhoneNumber"
                    placeholder="Parent phone number"
                    value={form.parentPhoneNumber}
                    onChange={handleChange}
                  />
                </>
              ) : (
                <>
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    name="teacherFullName"
                    placeholder="Teacher full name"
                    value={form.teacherFullName}
                    onChange={handleChange}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    name="teacherEmail"
                    type="email"
                    placeholder="Teacher email"
                    value={form.teacherEmail}
                    onChange={handleChange}
                  />
                </>
              )}

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  onClick={() => {
                    setModalOpen(false)
                    setError('')
                    setSuccess('')
                    setCreatedCredentials(null)
                  }}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : creationType === 'STUDENT' ? 'Create Student + Parent' : 'Create Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </DashboardShell>
  )
}
