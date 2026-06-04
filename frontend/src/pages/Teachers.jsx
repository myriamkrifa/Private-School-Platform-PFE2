import { useCallback, useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import FormModal from '../components/FormModal'
import { useCreateAccount } from '../context/CreateAccountContext'
import { useConfirm } from '../context/ConfirmDialogContext'
import {
  deleteTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher
} from '../services/auth.service'

const TEACHER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE']

const emptyForm = {
  name: '',
  email: '',
  subject: '',
  firstName: '',
  lastName: '',
  phone: '',
  specialty: '',
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
    firstName: teacher.firstName || '',
    lastName: teacher.lastName || '',
    phone: teacher.phone || '',
    specialty: teacher.specialty || '',
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
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        phone: form.phone.trim() || null,
        specialty: form.specialty.trim() || null,
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
            className="rounded-lg bg-[#e97828] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#d56a1f]"
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
                      <button
                        type="button"
                        className="btn-icon"
                        title="Edit teacher"
                        aria-label={`Edit ${teacher.name}`}
                        onClick={() => handleEdit(teacher)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-icon-danger"
                        title="Delete teacher"
                        aria-label={`Delete ${teacher.name}`}
                        disabled={deletingId === teacher.id}
                        onClick={() => handleDelete(teacher)}
                      >
                        {deletingId === teacher.id ? '…' : '🗑️'}
                      </button>
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
                <input className="modal-field" name="subject" placeholder="Subject" value={form.subject} onChange={handleFormChange} required />
                <select className="modal-field" name="status" value={form.status} onChange={handleFormChange}>
                  {TEACHER_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="form-row-2">
                <input className="modal-field" name="firstName" placeholder="First name" value={form.firstName} onChange={handleFormChange} />
                <input className="modal-field" name="lastName" placeholder="Last name" value={form.lastName} onChange={handleFormChange} />
              </div>
              <div className="form-row-2">
                <input className="modal-field" name="specialty" placeholder="Specialty" value={form.specialty} onChange={handleFormChange} />
                <input className="modal-field" name="phone" placeholder="Phone" value={form.phone} onChange={handleFormChange} />
              </div>
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
