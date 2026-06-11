import { useCallback, useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import FormModal from '../components/FormModal'
import { useAuth } from '../context/AuthContext'
import { useCreateAccount } from '../context/CreateAccountContext'
import { useConfirm } from '../context/ConfirmDialogContext'
import {
  deleteStudent,
  getAllClasses,
  getAllStudents,
  getStudentById,
  updateStudent
} from '../services/auth.service'

const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED']

const emptyForm = {
  name: '',
  email: '',
  grade: '',
  firstName: '',
  lastName: '',
  birthDate: '',
  gender: '',
  address: '',
  phone: '',
  enrollmentDate: '',
  status: 'ACTIVE',
  classId: ''
}

function toDateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function studentToForm(student) {
  return {
    name: student.name || '',
    email: student.email || '',
    grade: student.grade || '',
    firstName: student.firstName || '',
    lastName: student.lastName || '',
    birthDate: toDateInputValue(student.birthDate),
    gender: student.gender || '',
    address: student.address || '',
    phone: student.phone || '',
    enrollmentDate: toDateInputValue(student.enrollmentDate),
    status: student.status || 'ACTIVE',
    classId: student.classId ? String(student.classId) : ''
  }
}

function StudentsContent() {
  const { user } = useAuth()
  const { openCreateModal, createdVersion } = useCreateAccount()
  const { confirm } = useConfirm()
  const isAdmin = user?.role === 'ADMIN'

  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [modalLoading, setModalLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAllStudents()
      setStudents(res.data?.data || [])
    } catch (err) {
      console.error('Error fetching students:', err)
      setStudents([])
      setError(err.response?.data?.message || 'Failed to load students.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents, createdVersion])

  useEffect(() => {
    getAllClasses()
      .then((res) => setClasses(res.data?.data || []))
      .catch(() => setClasses([]))
  }, [])

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  const closeEditModal = () => {
    if (saving) return
    setEditOpen(false)
    setEditingStudent(null)
    setForm(emptyForm)
    setModalLoading(false)
    setError('')
  }

  const handleEdit = async (student) => {
    setEditOpen(true)
    setEditingStudent(student)
    setForm(studentToForm(student))
    setError('')
    setSuccess('')
    setModalLoading(true)
    try {
      const res = await getStudentById(student.id)
      const full = res.data?.data
      if (full) {
        setEditingStudent(full)
        setForm(studentToForm(full))
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load student details.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!editingStudent) return

    if (!form.name.trim() || !form.email.trim() || !form.grade.trim()) {
      setError('Name, email, and grade are required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        grade: form.grade.trim(),
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        birthDate: form.birthDate || null,
        gender: form.gender.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        enrollmentDate: form.enrollmentDate || null,
        status: form.status,
        classId: form.classId || null
      }

      await updateStudent(editingStudent.id, payload)
      setSuccess('Student updated successfully.')
      closeEditModal()
      await fetchStudents()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update student.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (student) => {
    const confirmed = await confirm({
      title: 'Delete student',
      message: `Delete student "${student.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    })
    if (!confirmed) return

    setDeletingId(student.id)
    setError('')
    setSuccess('')
    try {
      await deleteStudent(student.id)
      setStudents((prev) => prev.filter((s) => s.id !== student.id))
      setSuccess(`Student "${student.name}" was deleted.`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete student.')
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

      {isAdmin ? (
        <section className="page-card mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Students</h2>
              <p className="text-sm text-slate-500">Add a new student account with a linked parent.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-inline"
              onClick={() => openCreateModal('STUDENT')}
            >
              + Create Student
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="page-card"><p>Loading students...</p></div>
      ) : students.length === 0 ? (
        <div className="page-card"><p>No students found.</p></div>
      ) : (
        <section className="page-card page-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Grade</th>
                <th>Class</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="student-id-cell">{student.id}</td>
                  <td>{student.name}</td>
                  <td>{student.email}</td>
                  <td>{student.grade}</td>
                  <td>{student.class?.name || '—'}</td>
                  <td>{student.status || 'ACTIVE'}</td>
                  <td className="actions-col">
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        title="Edit student"
                        aria-label={`Edit ${student.name}`}
                        onClick={() => handleEdit(student)}
                      >
                        ✏️
                      </button>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="btn-icon btn-icon-danger"
                          title="Delete student"
                          aria-label={`Delete ${student.name}`}
                          disabled={deletingId === student.id}
                          onClick={() => handleDelete(student)}
                        >
                          {deletingId === student.id ? '…' : '🗑️'}
                        </button>
                      ) : null}
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
          accent="blue"
          title="Edit Student"
          subtitle={`Update profile information for ${editingStudent?.name || 'this student'}.`}
          onClose={closeEditModal}
          closeDisabled={saving}
          footer={
            !modalLoading ? (
              <>
                <button
                  type="button"
                  className="modal-btn modal-btn--cancel"
                  onClick={closeEditModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-student-form"
                  className="modal-btn modal-btn--blue"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : null
          }
        >
          {error ? <p className="modal-alert modal-alert--error">{error}</p> : null}
          {success ? <p className="modal-alert modal-alert--success">{success}</p> : null}

          {modalLoading ? (
            <p className="text-sm text-slate-500">Loading student details…</p>
          ) : (
            <form id="edit-student-form" className="modal-form-grid" onSubmit={handleSave}>
              <input
                className="modal-field"
                  name="name"
                  placeholder="Full name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                />
              <input
                className="modal-field"
                type="email"
                  name="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={handleFormChange}
                  required
                />
                <div className="form-row-2">
                <input
                  className="modal-field"
                  name="firstName"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={handleFormChange}
                  />
                <input
                  className="modal-field"
                  name="lastName"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-row-2">
                <input
                  className="modal-field"
                  name="grade"
                    placeholder="Grade (e.g. Primary 1)"
                    value={form.grade}
                    onChange={handleFormChange}
                    required
                  />
                <select
                  className="modal-field"
                  name="status"
                    value={form.status}
                    onChange={handleFormChange}
                  >
                    {STUDENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              <select
                className="modal-field"
                name="classId"
                  value={form.classId}
                  onChange={handleFormChange}
                >
                  <option value="">No class assigned</option>
                  {classes.map((klass) => (
                    <option key={klass.id} value={String(klass.id)}>
                      {klass.name}
                    </option>
                  ))}
                </select>
                <div className="form-row-2">
                <input
                  className="modal-field"
                  type="date"
                  name="birthDate"
                    value={form.birthDate}
                    onChange={handleFormChange}
                  />
                <input
                  className="modal-field"
                  type="date"
                  name="enrollmentDate"
                    value={form.enrollmentDate}
                    onChange={handleFormChange}
                  />
                </div>
              <input
                className="modal-field"
                name="gender"
                  placeholder="Gender"
                  value={form.gender}
                  onChange={handleFormChange}
                />
              <input
                className="modal-field"
                name="phone"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={handleFormChange}
                />
              <textarea
                className="modal-field"
                name="address"
                  placeholder="Address"
                  rows={2}
                  value={form.address}
                  onChange={handleFormChange}
              />
            </form>
          )}
        </FormModal>
      ) : null}
    </>
  )
}

export default function Students() {
  return (
    <DashboardShell title="Students" subtitle="Browse the student list and monitor their status.">
      <StudentsContent />
    </DashboardShell>
  )
}
