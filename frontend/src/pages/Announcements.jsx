import { useEffect, useState } from 'react'
import {
  createAnnouncement,
  getAllClasses,
  getAnnouncements
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'
import { useAuth } from '../context/AuthContext'

const initialForm = { title: '', content: '', targetRole: '', classId: '' }

export default function Announcements() {
  const { user } = useAuth()
  const canPublish = user?.role === 'ADMIN' || user?.role === 'TEACHER'

  const [announcements, setAnnouncements] = useState([])
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = async () => {
    try {
      const response = await getAnnouncements()
      setAnnouncements(response.data?.data || [])
      if (canPublish) {
        const classesRes = await getAllClasses()
        setClasses(classesRes.data?.data || [])
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load announcements.')
    }
  }

  useEffect(() => { refresh() }, [canPublish])

  const publish = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!form.title.trim() || !form.content.trim()) {
      setError('Please provide a title and content.')
      return
    }
    setBusy(true)
    try {
      await createAnnouncement({
        title: form.title.trim(),
        content: form.content.trim(),
        targetRole: form.targetRole || null,
        classId: form.classId ? Number(form.classId) : null
      })
      setForm(initialForm)
      setSuccess('Announcement published.')
      await refresh()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish announcement.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardShell title="Announcements" subtitle="Publish and read school announcements.">
      <div className="space-y-4">
        {canPublish ? (
          <section className="page-card">
            <form onSubmit={publish} className="page-card">
              <h3>New Announcement</h3>
              <input
                className="form-input"
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                className="form-input"
                rows={3}
                placeholder="Content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  className="form-input"
                  value={form.targetRole}
                  onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                >
                  <option value="">Everyone</option>
                  <option value="STUDENT">Students</option>
                  <option value="PARENT">Parents</option>
                  <option value="TEACHER">Teachers</option>
                  <option value="ADMIN">Admins</option>
                </select>
                <select
                  className="form-input"
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                >
                  <option value="">Any class</option>
                  {classes.map((klass) => (
                    <option key={klass.id} value={klass.id}>{klass.name}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Publishing…' : 'Publish'}
              </button>
              {error ? <p className="field-error">{error}</p> : null}
              {success ? <p style={{ color: 'var(--success)' }}>{success}</p> : null}
            </form>
          </section>
        ) : null}

        <section className="page-card page-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Content</th>
                <th>Target</th>
                <th>Class</th>
                <th>By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {announcements.length === 0 ? (
                <tr><td colSpan={6}>No announcements yet.</td></tr>
              ) : announcements.map((announcement) => (
                <tr key={announcement.id}>
                  <td>{announcement.title}</td>
                  <td>{announcement.content}</td>
                  <td>{announcement.targetRole || 'Everyone'}</td>
                  <td>{announcement.class?.name || '-'}</td>
                  <td>{announcement.createdBy?.name || 'System'}</td>
                  <td>{new Date(announcement.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </DashboardShell>
  )
}
