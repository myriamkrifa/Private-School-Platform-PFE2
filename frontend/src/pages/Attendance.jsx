import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getMyChildren,
  getStudentAttendance,
  justifyAbsence,
  updateAttendance
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'
import TeacherAttendanceMarking from '../components/TeacherAttendanceMarking'

const STATUS_BADGE_CLASS = {
  PRESENT: 'attendance-history-badge--present',
  ABSENT: 'attendance-history-badge--absent',
  LATE: 'attendance-history-badge--late',
  EXCUSED: 'attendance-history-badge--excused'
}

const HISTORY_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']

export default function Attendance() {
  const { user } = useAuth()

  const [studentId, setStudentId] = useState('')
  const [children, setChildren] = useState([])
  const [records, setRecords] = useState([])
  const [justifyForm, setJustifyForm] = useState({ id: '', justification: '' })
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [editStatus, setEditStatus] = useState('PRESENT')
  const [savingRecordId, setSavingRecordId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canModifyHistory = user?.role === 'ADMIN' || user?.role === 'TEACHER'

  useEffect(() => {
    if (user?.role !== 'PARENT') return
    getMyChildren()
      .then((response) => {
        const list = response.data?.data || []
        setChildren(list)
        if (list[0]?.id) setStudentId(String(list[0].id))
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load children.'))
  }, [user?.role])

  const loadAttendance = async (id) => {
    if (!id) return
    setError('')
    setEditingRecordId(null)
    try {
      const response = await getStudentAttendance(id)
      setRecords(response.data?.data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance.')
    }
  }

  useEffect(() => {
    if (studentId) loadAttendance(studentId)
  }, [studentId])

  const startModify = (row) => {
    setEditingRecordId(row.id)
    setEditStatus(row.status || 'PRESENT')
    setError('')
    setSuccess('')
  }

  const cancelModify = () => {
    setEditingRecordId(null)
    setEditStatus('PRESENT')
  }

  const saveModify = async (recordId) => {
    setError('')
    setSuccess('')
    setSavingRecordId(recordId)
    try {
      await updateAttendance(recordId, { status: editStatus })
      setRecords((prev) =>
        prev.map((row) => (row.id === recordId ? { ...row, status: editStatus } : row))
      )
      setSuccess('Attendance record updated.')
      setEditingRecordId(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update attendance.')
    } finally {
      setSavingRecordId(null)
    }
  }

  const submitJustification = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    try {
      await justifyAbsence(justifyForm.id, { justification: justifyForm.justification })
      setJustifyForm({ id: '', justification: '' })
      setSuccess('Absence justification saved.')
      if (studentId) await loadAttendance(studentId)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to justify absence.')
    }
  }

  const showHistory =
    user?.role === 'PARENT' ||
    user?.role === 'STUDENT' ||
    user?.role === 'ADMIN' ||
    user?.role === 'TEACHER'
  const showJustify = user?.role === 'PARENT' || user?.role === 'TEACHER' || user?.role === 'ADMIN'

  return (
    <DashboardShell
      title="Attendance"
      subtitle={
        user?.role === 'TEACHER' || user?.role === 'ADMIN'
          ? 'Mark daily attendance by class and subject.'
          : 'Track daily attendance and absence history.'
      }
    >
      <div className="attendance-page space-y-4">
        {user?.role === 'TEACHER' || user?.role === 'ADMIN' ? (
          <TeacherAttendanceMarking />
        ) : null}

        {showHistory ? (
          <section className="page-card attendance-history">
            <header className="attendance-history-header">
              <h3>Attendance history</h3>
              <p className="text-sm text-slate-500">View past records by student.</p>
            </header>

            <div className="attendance-history-toolbar">
              {user?.role === 'PARENT' ? (
                <select
                  className="form-input"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Select child</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  placeholder="Student ID"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
              )}
              <button className="btn btn-primary" type="button" onClick={() => loadAttendance(studentId)}>
                Load history
              </button>
            </div>

            {error ? <p className="field-error attendance-feedback">{error}</p> : null}
            {success ? <p className="attendance-success attendance-feedback">{success}</p> : null}

            <ul className="attendance-history-list">
              {records.length === 0 ? (
                <li className="attendance-history-empty">No attendance records yet.</li>
              ) : (
                records.map((row) => (
                  <li key={row.id} className="attendance-history-item">
                    <div>
                      <p className="attendance-history-date">
                        {new Date(row.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                      <p className="attendance-history-subject">{row.course?.title || 'General'}</p>
                      {row.class?.name ? (
                        <p className="attendance-history-class">{row.class.name}</p>
                      ) : null}
                    </div>

                    {editingRecordId === row.id ? (
                      <div className="attendance-history-actions">
                        <select
                          className="form-input attendance-history-status-select"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          disabled={savingRecordId === row.id}
                        >
                          {HISTORY_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={savingRecordId === row.id}
                          onClick={() => saveModify(row.id)}
                        >
                          {savingRecordId === row.id ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={savingRecordId === row.id}
                          onClick={cancelModify}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="attendance-history-actions">
                        <span
                          className={`attendance-history-badge ${
                            STATUS_BADGE_CLASS[row.status] || ''
                          }`}
                        >
                          {row.status}
                        </span>
                        {canModifyHistory ? (
                          <button
                            type="button"
                            className="btn btn-sm attendance-history-modify-btn"
                            onClick={() => startModify(row)}
                          >
                            Modify
                          </button>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {showJustify ? (
          <section className="page-card">
            <form onSubmit={submitJustification} className="space-y-3">
              <h3>Justify absence</h3>
              <p className="text-sm text-slate-500">
                Enter the attendance record ID from history above. Status will be set to EXCUSED.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  className="form-input"
                  placeholder="Attendance record ID"
                  value={justifyForm.id}
                  onChange={(e) => setJustifyForm({ ...justifyForm, id: e.target.value })}
                />
                <input
                  className="form-input md:col-span-2"
                  placeholder="Justification (e.g. doctor's note)"
                  value={justifyForm.justification}
                  onChange={(e) => setJustifyForm({ ...justifyForm, justification: e.target.value })}
                />
              </div>
              <button className="btn btn-primary" type="submit">Save justification</button>
            </form>
          </section>
        ) : null}
      </div>
    </DashboardShell>
  )
}
