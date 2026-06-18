import { useCallback, useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import FormModal from '../components/FormModal'
import { DeleteIconButton, EditIconButton } from '../components/TableIconButtons'
import { useCreateAccount } from '../context/CreateAccountContext'
import { useConfirm } from '../context/ConfirmDialogContext'
import {
  deleteTeacher,
  getAllTeachers,
  getSubjects,
  getTeacherById,
  updateTeacher
} from '../services/auth.service'

const TEACHER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE']

const emptyForm = {
  name: '',
  email: '',
  subject: '',
  phone: '',
  hireDate: '',
  status: 'ACTIVE'
}

function toDateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function teacherToForm(teacher) {
  return {
    name: teacher.name || '',
    email: teacher.email || '',
    subject: teacher.subject || '',
    phone: teacher.phone || '',
    hireDate: toDateInputValue(teacher.hireDate),
    status: teacher.status || 'ACTIVE'
  }
}

function TeachersContent() {
  const { openCreateModal, createdVersion } = useCreateAccount()
  const { confirm } = useConfirm()
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [modalLoading, setModalLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [subjects, setSubjects] = useState([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)

  const fetchTeachers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAllTeachers()
      setTeachers(res.data?.data || [])
    } catch (err) {
      console.error('Error fetching teachers:', err)
      setTeachers([])
      setError(err.response?.data?.message || 'Failed to load teachers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeachers()
  }, [fetchTeachers, createdVersion])

  useEffect(() => {
    if (!editOpen) return

    let cancelled = false
    setSubjectsLoading(true)

    getSubjects()
      .then((res) => {
        if (!cancelled) setSubjects(res.data?.data || [])
      })
      .catch(() => {
        if (!cancelled) setSubjects([])
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [editOpen])

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  const closeEditModal = () => {
    if (saving) return
    setEditOpen(false)
    setEditingTeacher(null)
    setForm(emptyForm)
    setModalLoading(false)
    setError('')
  }

  const handleEdit = async (teacher) => {
    setEditOpen(true)
    setEditingTeacher(teacher)
    setForm(teacherToForm(teacher))
    setError('')
    setSuccess('')
    setModalLoading(true)
    try {
      const res = await getTeacherById(teacher.id)
      const full = res.data?.data
      if (full) {
        setEditingTeacher(full)
        setForm(teacherToForm(full))
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load teacher details.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!editingTeacher) return

    if (!form.name.trim() || !form.email.trim() || !form.subject.trim()) {
      setError('Name, email, and subject are required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateTeacher(editingTeacher.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        phone: form.phone.trim() || null,
        hireDate: form.hireDate || null,
        status: form.status
      })
      setSuccess('Teacher updated successfully.')
      closeEditModal()
      await fetchTeachers()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update teacher.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (teacher) => {
    const confirmed = await confirm({
      title: 'Delete teacher',
      message: `Delete teacher "${teacher.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    })
    if (!confirmed) return

    setDeletingId(teacher.id)
    setError('')
    setSuccess('')
    try {
      await deleteTeacher(teacher.id)
      setTeachers((prev) => prev.filter((t) => t.id !== teacher.id))
      setSuccess(`Teacher "${teacher.name}" was deleted.`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete teacher.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {error && !editOpen ? (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {success && !editOpen ? (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
      ) : null}

      <section className="page-card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Teachers</h2>
            <p className="text-sm text-slate-500">Add a new teacher account to the staff roster.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-inline"
            onClick={() => openCreateModal('TEACHER')}
          >
            + Create Teacher
          </button>
        </div>
      </section>

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
                <th>Subject</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>{teacher.name}</td>
                  <td>{teacher.email}</td>
                  <td>{teacher.subject}</td>
                  <td>{teacher.status || 'ACTIVE'}</td>
                  <td className="actions-col">
                    <div className="table-actions">
                      <EditIconButton
                        label={`Edit ${teacher.name}`}
                        onClick={() => handleEdit(teacher)}
                      />
                      <DeleteIconButton
                        label={`Delete ${teacher.name}`}
                        loading={deletingId === teacher.id}
                        onClick={() => handleDelete(teacher)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {editOpen ? (
        <FormModal
          accent="orange"
          title="Edit Teacher"
          subtitle={`Update profile information for ${editingTeacher?.name || 'this teacher'}.`}
          onClose={closeEditModal}
          closeDisabled={saving}
          footer={
            !modalLoading ? (
              <>
                <button type="button" className="modal-btn modal-btn--cancel" onClick={closeEditModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" form="edit-teacher-form" className="modal-btn modal-btn--orange" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : null
          }
        >
          {error ? <p className="modal-alert modal-alert--error">{error}</p> : null}
          {modalLoading ? (
            <p className="text-sm text-slate-500">Loading teacher details…</p>
          ) : (
            <form id="edit-teacher-form" className="modal-form-grid" onSubmit={handleSave}>
              <input className="modal-field" name="name" placeholder="Full name" value={form.name} onChange={handleFormChange} required />
              <input className="modal-field" type="email" name="email" placeholder="Email" value={form.email} onChange={handleFormChange} required />
              <div className="form-row-2">
                <select
                  className="modal-field"
                  name="subject"
                  value={form.subject}
                  onChange={handleFormChange}
                  required
                  disabled={subjectsLoading}
                >
                  <option value="">{subjectsLoading ? 'Loading subjects...' : 'Select subject'}</option>
                  {form.subject &&
                  !subjects.some((subject) => subject.title === form.subject) ? (
                    <option value={form.subject}>{form.subject}</option>
                  ) : null}
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.title}>
                      {subject.code ? `${subject.title} (${subject.code})` : subject.title}
                    </option>
                  ))}
                </select>
                <select className="modal-field" name="status" value={form.status} onChange={handleFormChange}>
                  {TEACHER_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <input className="modal-field" name="phone" placeholder="Phone" value={form.phone} onChange={handleFormChange} />
              <input className="modal-field" type="date" name="hireDate" value={form.hireDate} onChange={handleFormChange} />
            </form>
          )}
        </FormModal>
      ) : null}
    </>
  )
}

export default function Teachers() {
  return (
    <DashboardShell title="Teachers" subtitle="Review the staff roster and contact details.">
      <TeachersContent />
    </DashboardShell>
  )
}
