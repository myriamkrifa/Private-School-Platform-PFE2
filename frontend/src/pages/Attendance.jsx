import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import {
  getMyAttendance,
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
const STUDENT_REFRESH_MS = 20000

export default function Attendance() {
  const { user } = useAuth()
  const { refreshUnreadCount } = useNotifications()
  const isStudent = user?.role === 'STUDENT'

  const [studentId, setStudentId] = useState('')
  const [children, setChildren] = useState([])
  const [records, setRecords] = useState([])
  const [justifyForm, setJustifyForm] = useState({ subject: '', justification: '' })
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [editStatus, setEditStatus] = useState('PRESENT')
  const [savingRecordId, setSavingRecordId] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
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

  const loadAttendance = useCallback(async (id) => {
    setError('')
    setEditingRecordId(null)
    setLoadingHistory(true)
    try {
      const response = isStudent
        ? await getMyAttendance()
        : await getStudentAttendance(id)
      setRecords(response.data?.data || [])
      if (isStudent) {
        await refreshUnreadCount()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance.')
      setRecords([])
    } finally {
      setLoadingHistory(false)
    }
  }, [isStudent, refreshUnreadCount])

  useEffect(() => {
    if (isStudent) {
      loadAttendance()
      const intervalId = setInterval(() => loadAttendance(), STUDENT_REFRESH_MS)
      return () => clearInterval(intervalId)
    }
    if (studentId) loadAttendance(studentId)
  }, [isStudent, studentId, loadAttendance])

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

  const findRecordBySubject = (subjectName) => {
    const normalized = subjectName.trim().toLowerCase()
    if (!normalized) return null

    const matches = records.filter((row) => {
      const title = (row.course?.title || 'General').toLowerCase()
      return title === normalized && row.status === 'ABSENT'
    })

    if (matches.length === 0) return null
    return matches[0]
  }

  const submitJustification = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const record = findRecordBySubject(justifyForm.subject)
    if (!record) {
      setError(
        records.length === 0
          ? 'Load attendance history first, then enter the subject name of an absent record.'
          : 'No absent record found for that subject. Check the name matches history above (e.g. English).'
      )
      return
    }

    try {
      await justifyAbsence(record.id, { justification: justifyForm.justification })
      setJustifyForm({ subject: '', justification: '' })
      setSuccess('Absence justification saved.')
      if (isStudent) {
        await loadAttendance()
      } else if (studentId) {
        await loadAttendance(studentId)
      }
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
          : isStudent
            ? 'Your attendance updates automatically when your teacher saves the class register.'
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
              <h3>{isStudent ? 'My attendance' : 'Attendance history'}</h3>
              <p className="text-sm text-slate-500">
                {isStudent
                  ? 'Records appear here as soon as your teacher marks your class.'
                  : 'View past records by student.'}
              </p>
            </header>

            {!isStudent ? (
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
            ) : (
              <p className="attendance-history-live text-sm text-slate-500">
                Live updates every {STUDENT_REFRESH_MS / 1000} seconds. You also get a notification when attendance is saved.
              </p>
            )}

            {error ? <p className="field-error attendance-feedback">{error}</p> : null}
            {success ? <p className="attendance-success attendance-feedback">{success}</p> : null}

            <ul className="attendance-history-list">
              {loadingHistory && records.length === 0 ? (
                <li className="attendance-history-empty">Loading attendance…</li>
              ) : records.length === 0 ? (
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
                      {row.updatedAt ? (
                        <p className="attendance-history-recorded">
                          Recorded at {new Date(row.updatedAt).toLocaleString()}
                        </p>
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
                Enter the subject name from history above (e.g. English). Status will be set to EXCUSED.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  className="form-input"
                  placeholder="Subject name (e.g. English)"
                  value={justifyForm.subject}
                  onChange={(e) => setJustifyForm({ ...justifyForm, subject: e.target.value })}
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
