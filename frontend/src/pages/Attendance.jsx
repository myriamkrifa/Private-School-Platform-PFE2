import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  bulkUpsertAttendance,
  getMyChildren,
  getStudentAttendance,
  getTeacherClasses,
  getTeacherClassStudents,
  getTeacherClassSubjects,
  justifyAbsence
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

const STATUS_VALUES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']

export default function Attendance() {
  const { user } = useAuth()

  // Teacher state
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [statusMap, setStatusMap] = useState({})
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)

  // Read state
  const [studentId, setStudentId] = useState('')
  const [children, setChildren] = useState([])
  const [records, setRecords] = useState([])

  const [justifyForm, setJustifyForm] = useState({ id: '', justification: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        if (user?.role === 'TEACHER') {
          const response = await getTeacherClasses()
          setClasses(response.data?.data || [])
        }
        if (user?.role === 'PARENT') {
          const response = await getMyChildren()
          const list = response.data?.data || []
          setChildren(list)
          if (list[0]?.id) setStudentId(String(list[0].id))
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to initialize attendance view.')
      }
    }
    load()
  }, [user?.role])

  useEffect(() => {
    const load = async () => {
      if (!selectedClassId || user?.role !== 'TEACHER') return
      try {
        const [studentsRes, subjectsRes] = await Promise.all([
          getTeacherClassStudents(selectedClassId),
          getTeacherClassSubjects(selectedClassId)
        ])
        setStudents(studentsRes.data?.data || [])
        setSubjects(subjectsRes.data?.data || [])
        setStatusMap({})
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load class details.')
      }
    }
    load()
  }, [selectedClassId, user?.role])

  const loadAttendance = async (id) => {
    if (!id) return
    setError('')
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

  const submitAttendance = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!selectedClassId || !selectedCourseId) {
      setError('Select class and subject first.')
      return
    }
    setSubmitting(true)
    try {
      await bulkUpsertAttendance({
        classId: Number(selectedClassId),
        courseId: Number(selectedCourseId),
        date: new Date(date).toISOString(),
        records: students.map((student) => ({
          studentId: student.id,
          status: statusMap[student.id] || 'PRESENT'
        }))
      })
      setSuccess('Attendance saved.')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save attendance.')
    } finally {
      setSubmitting(false)
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

  return (
    <DashboardShell title="Attendance" subtitle="Track daily attendance and absence history.">
      <div className="space-y-4">
        {user?.role === 'TEACHER' ? (
          <section className="page-card">
            <form onSubmit={submitAttendance} className="page-card">
              <h3>Mark attendance</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <select
                  className="form-input"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="">Select class</option>
                  {classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
                </select>
                <select
                  className="form-input"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                >
                  <option value="">Select subject</option>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
                </select>
                <input
                  className="form-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <table className="data-table">
                <thead><tr><th>Student</th><th>Status</th></tr></thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr><td colSpan={2}>Select a class to load students.</td></tr>
                  ) : students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>
                        <select
                          className="form-input"
                          value={statusMap[student.id] || 'PRESENT'}
                          onChange={(e) => setStatusMap((prev) => ({ ...prev, [student.id]: e.target.value }))}
                        >
                          {STATUS_VALUES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={submitting || !selectedClassId || !selectedCourseId}
              >
                {submitting ? 'Saving…' : 'Save Attendance'}
              </button>
              {error ? <p className="field-error">{error}</p> : null}
              {success ? <p style={{ color: 'var(--success)' }}>{success}</p> : null}
            </form>
          </section>
        ) : null}

        <section className="page-card">
          <div className="page-card">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {user?.role === 'PARENT' ? (
                <select
                  className="form-input"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Select child</option>
                  {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
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
                Load History
              </button>
            </div>
          </div>

          <div className="page-table-card">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Subject</th><th>Status</th><th>Justification</th></tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={4}>No attendance records.</td></tr>
                ) : records.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.course?.title || '-'}</td>
                    <td>{row.status}</td>
                    <td>{row.justification || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {(user?.role === 'PARENT' || user?.role === 'TEACHER' || user?.role === 'ADMIN') ? (
          <section className="page-card">
            <form onSubmit={submitJustification} className="page-card">
              <h3>Justify Absence</h3>
              <p className="text-xs text-slate-500">
                Use the attendance record ID from the table above. Status will be set to EXCUSED.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  className="form-input"
                  placeholder="Attendance Record ID"
                  value={justifyForm.id}
                  onChange={(e) => setJustifyForm({ ...justifyForm, id: e.target.value })}
                />
                <input
                  className="form-input md:col-span-2"
                  placeholder="Justification (e.g. Doctor's note)"
                  value={justifyForm.justification}
                  onChange={(e) => setJustifyForm({ ...justifyForm, justification: e.target.value })}
                />
              </div>
              <button className="btn btn-primary" type="submit">Save Justification</button>
            </form>
          </section>
        ) : null}
      </div>
    </DashboardShell>
  )
}
