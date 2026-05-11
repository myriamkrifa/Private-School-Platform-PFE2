import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import { useAuth } from '../context/AuthContext'
import {
  createSubject,
  deleteSubject,
  getSubjects,
  updateSubject
} from '../services/auth.service'

const initialForm = {
  title: '',
  code: '',
  coefficient: 1,
  description: '',
  levelTag: ''
}

export default function Subjects() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const response = await getSubjects()
      setSubjects(response.data?.data || [])
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subjects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleEdit = (subject) => {
    setEditingId(subject.id)
    setForm({
      title: subject.title || '',
      code: subject.code || '',
      coefficient: subject.coefficient ?? 1,
      description: subject.description || '',
      levelTag: subject.levelTag || ''
    })
    setError('')
    setSuccess('')
  }

  const handleCancel = () => {
    setEditingId(null)
    setForm(initialForm)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isAdmin) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        title: form.title.trim(),
        code: form.code.trim() || null,
        coefficient: Number(form.coefficient) || 1,
        description: form.description.trim() || null,
        levelTag: form.levelTag || null
      }
      if (editingId) {
        await updateSubject(editingId, payload)
        setSuccess('Subject updated.')
      } else {
        await createSubject(payload)
        setSuccess('Subject created.')
      }
      setForm(initialForm)
      setEditingId(null)
      await refresh()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save subject.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (subject) => {
    if (!isAdmin) return
    if (!window.confirm(`Delete subject "${subject.title}"?`)) return
    setBusy(true)
    setError('')
    try {
      await deleteSubject(subject.id)
      setSuccess('Subject deleted.')
      await refresh()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete subject.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardShell title="Subjects" subtitle="Manage school subjects, codes, and coefficients.">
      <div className="space-y-4">
        {isAdmin ? (
          <section className="page-card">
            <form onSubmit={handleSubmit} className="page-card">
              <h3>{editingId ? 'Edit Subject' : 'Create Subject'}</h3>
              <input
                className="form-input"
                placeholder="Title (e.g. Mathematics)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <input
                className="form-input"
                placeholder="Code (e.g. MATH)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <input
                className="form-input"
                type="number"
                min="1"
                step="0.5"
                placeholder="Coefficient"
                value={form.coefficient}
                onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
              />
              <select
                className="form-input"
                value={form.levelTag}
                onChange={(e) => setForm({ ...form, levelTag: e.target.value })}
              >
                <option value="">Any level</option>
                <option value="PRIMARY">Primary</option>
                <option value="SECONDARY">Secondary</option>
              </select>
              <textarea
                className="form-input"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <div className="flex gap-2">
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : editingId ? 'Update Subject' : 'Create Subject'}
                </button>
                {editingId ? (
                  <button type="button" className="btn" onClick={handleCancel} disabled={busy}>
                    Cancel
                  </button>
                ) : null}
              </div>
              {error ? <p className="field-error">{error}</p> : null}
              {success ? <p style={{ color: 'var(--success)' }}>{success}</p> : null}
            </form>
          </section>
        ) : null}

        <section className="page-card page-table-card">
          {loading ? (
            <p>Loading subjects…</p>
          ) : subjects.length === 0 ? (
            <p>No subjects yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Code</th>
                  <th>Coef.</th>
                  <th>Level</th>
                  <th>Linked</th>
                  {isAdmin ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td>{subject.title}</td>
                    <td>{subject.code || '-'}</td>
                    <td>{subject.coefficient ?? 1}</td>
                    <td>{subject.levelTag || 'ANY'}</td>
                    <td>
                      {subject._count?.teachingAssignments || 0} assignments ·{' '}
                      {subject._count?.grades || 0} grades
                    </td>
                    {isAdmin ? (
                      <td>
                        <button className="btn" type="button" onClick={() => handleEdit(subject)}>Edit</button>
                        <button className="btn" type="button" onClick={() => handleDelete(subject)}>Delete</button>
                      </td>
                    ) : null}
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
