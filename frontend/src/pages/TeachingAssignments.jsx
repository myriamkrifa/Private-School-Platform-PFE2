import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import {
  createTeachingAssignment,
  deleteTeachingAssignment,
  getAllClasses,
  getAllTeachers,
  getSubjects,
  getTeachingAssignments
} from '../services/auth.service'
import { useConfirm } from '../context/ConfirmDialogContext'

export default function TeachingAssignments() {
  const { confirm } = useConfirm()
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ teacherId: '', classId: '', courseId: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [classesRes, teachersRes, subjectsRes, rowsRes] = await Promise.all([
        getAllClasses(),
        getAllTeachers(),
        getSubjects(),
        getTeachingAssignments()
      ])
      setClasses(classesRes.data?.data || [])
      setTeachers(teachersRes.data?.data || [])
      setSubjects(subjectsRes.data?.data || [])
      setRows(rowsRes.data?.data || [])
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load teaching assignments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!form.teacherId || !form.classId || !form.courseId) {
      setError('Please select a teacher, class, and subject.')
      return
    }
    setBusy(true)
    try {
      await createTeachingAssignment({
        teacherId: Number(form.teacherId),
        classId: Number(form.classId),
        courseId: Number(form.courseId)
      })
      setForm({ teacherId: '', classId: '', courseId: '' })
      setSuccess('Teaching assignment saved.')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save teaching assignment.')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Remove assignment',
      message: 'Remove this teaching assignment? This action cannot be undone.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      variant: 'danger'
    })
    if (!confirmed) return
    try {
      await deleteTeachingAssignment(id)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete teaching assignment.')
    }
  }

  return (
    <DashboardShell title="Teaching Assignments" subtitle="Assign teachers to specific subjects in specific classes.">
      <div className="space-y-4">
        <section className="page-card">
          <form onSubmit={onSubmit} className="page-card">
            <select
              className="form-input"
              value={form.teacherId}
              onChange={(event) => setForm((prev) => ({ ...prev, teacherId: event.target.value }))}
            >
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
            <select
              className="form-input"
              value={form.classId}
              onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))}
            >
              <option value="">Select class</option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>{klass.name}</option>
              ))}
            </select>
            <select
              className="form-input"
              value={form.courseId}
              onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}{subject.code ? ` (${subject.code})` : ''}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Assign'}
            </button>
            {error ? <p className="field-error">{error}</p> : null}
            {success ? <p style={{ color: 'var(--success)' }}>{success}</p> : null}
          </form>
        </section>

        <section className="page-card page-table-card">
          {loading ? (
            <p>Loading…</p>
          ) : rows.length === 0 ? (
            <p>No teaching assignments yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.teacher?.name}</td>
                    <td>{row.class?.name}</td>
                    <td>{row.course?.title}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-'}</td>
                    <td>
                      <button className="btn" type="button" onClick={() => onDelete(row.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
