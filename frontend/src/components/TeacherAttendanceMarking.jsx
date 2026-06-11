import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Check, Search, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  bulkUpsertAttendance,
  getAllClasses,
  getAttendanceMarkSheet,
  getClassAttendance,
  getTeacherClasses
} from '../services/auth.service'

const MARKING_STATUSES = [
  { value: 'PRESENT', label: 'Present', emoji: '✅', tone: 'present' },
  { value: 'ABSENT', label: 'Absent', emoji: '❌', tone: 'absent' },
  { value: 'LATE', label: 'Late', emoji: '⏰', tone: 'late' }
]

function studentInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

function studentRollLabel(student) {
  if (student.rollNumber) return String(student.rollNumber)
  if (student.grade && student.grade !== 'N/A') return student.grade
  return `ID-${student.id}`
}

function StudentAvatar({ student }) {
  const photo = student.photoUrl || student.avatarUrl || student.photo
  const initials = studentInitials(student.name)

  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        className="attendance-student-avatar attendance-student-avatar--photo"
      />
    )
  }

  return (
    <span className="attendance-student-avatar" aria-hidden>
      {initials}
    </span>
  )
}

function pickDefaultSubjectId(subjectList) {
  return subjectList.length > 0 ? String(subjectList[0].id) : ''
}

export default function TeacherAttendanceMarking() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [statusMap, setStatusMap] = useState({})
  const [search, setSearch] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const getStatus = useCallback(
    (studentId) => statusMap[studentId] || 'PRESENT',
    [statusMap]
  )

  const setStatus = (studentId, status) => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }))
  }

  useEffect(() => {
    if (authLoading || !user) return

    setClassesLoading(true)
    setError('')
    const loader = isAdmin
      ? getAllClasses().then((response) => response.data?.data || [])
      : getTeacherClasses().then((response) => response.data?.data || [])

    loader
      .then(setClasses)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load classes.'))
      .finally(() => setClassesLoading(false))
  }, [authLoading, user, isAdmin])

  useEffect(() => {
    if (!selectedClassId || authLoading || !user) {
      if (!selectedClassId) {
        setStudents([])
        setSubjects([])
        setSelectedCourseId('')
        setStatusMap({})
      }
      return
    }

    setLoadingStudents(true)
    setError('')
    setSuccess('')

    getAttendanceMarkSheet(selectedClassId)
      .then((response) => {
        const sheet = response.data?.data || {}
        const subjectList = sheet.subjects || []
        setStudents(sheet.students || [])
        setSubjects(subjectList)
        setSelectedCourseId(pickDefaultSubjectId(subjectList))
        setStatusMap({})
        setSearch('')
      })
      .catch((err) => {
        setStudents([])
        setSubjects([])
        setSelectedCourseId('')
        setError(err.response?.data?.message || 'Failed to load class students and subjects.')
      })
      .finally(() => setLoadingStudents(false))
  }, [selectedClassId, authLoading, user])

  useEffect(() => {
    if (!selectedClassId || !selectedCourseId || !date) return

    setLoadingRecords(true)
    getClassAttendance(selectedClassId, { date, courseId: selectedCourseId })
      .then((response) => {
        const records = response.data?.data || []
        const next = {}
        records.forEach((row) => {
          if (row.studentId) next[row.studentId] = row.status
        })
        setStatusMap((prev) => ({ ...prev, ...next }))
      })
      .catch(() => {
        // Non-blocking: user can still mark and save fresh attendance.
      })
      .finally(() => setLoadingRecords(false))
  }, [selectedClassId, selectedCourseId, date])

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return students
    return students.filter((student) => student.name?.toLowerCase().includes(query))
  }, [students, search])

  const summary = useMemo(() => {
    let present = 0
    let absent = 0
    let late = 0
    students.forEach((student) => {
      const status = getStatus(student.id)
      if (status === 'PRESENT') present += 1
      else if (status === 'ABSENT') absent += 1
      else if (status === 'LATE') late += 1
    })
    return { present, absent, late, total: students.length }
  }, [students, getStatus])

  const markAllPresent = () => {
    const next = {}
    students.forEach((student) => {
      next[student.id] = 'PRESENT'
    })
    setStatusMap(next)
  }

  const submitAttendance = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedClassId) {
      setError('Select a class first.')
      return
    }
    if (!selectedCourseId) {
      setError('Select a subject before saving.')
      return
    }
    if (students.length === 0) {
      setError('No students in this class.')
      return
    }

    setSubmitting(true)
    try {
      await bulkUpsertAttendance({
        classId: Number(selectedClassId),
        courseId: Number(selectedCourseId),
        date,
        records: students.map((student) => ({
          studentId: student.id,
          status: getStatus(student.id)
        }))
      })
      setSuccess(`Attendance saved for ${students.length} student(s).`)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to save attendance.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedClass = classes.find((c) => String(c.id) === String(selectedClassId))
  const selectedSubject = subjects.find((s) => String(s.id) === String(selectedCourseId))
  const canShowStudents = Boolean(selectedClassId)
  const needsSubject = Boolean(selectedClassId && subjects.length > 0 && !selectedCourseId)
  const noClassesAvailable = !authLoading && !classesLoading && classes.length === 0

  if (authLoading) {
    return (
      <section className="attendance-marking">
        <div className="attendance-loading">
          <div className="spinner" />
          <p>Loading…</p>
        </div>
      </section>
    )
  }

  return (
    <section className="attendance-marking">
      <form onSubmit={submitAttendance} className="attendance-marking-form">
        {(error || success) ? (
          <div className={`attendance-banner${error ? ' attendance-banner--error' : ' attendance-banner--success'}`}>
            {error || success}
          </div>
        ) : null}

        <header className="attendance-marking-header">
          <div>
            <h3 className="attendance-marking-title">Mark attendance</h3>
          </div>
          <button
            type="submit"
            className="btn btn-primary attendance-save-btn"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save Attendance'}
          </button>
        </header>

        <div className="attendance-filters">
          <label className="attendance-filter">
            <span className="attendance-filter-label">Class</span>
            <select
              className="form-input"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={classesLoading}
            >
              <option value="">Select class</option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>{klass.name}</option>
              ))}
            </select>
          </label>
          <label className={`attendance-filter${needsSubject ? ' attendance-filter--required' : ''}`}>
            <span className="attendance-filter-label">
              Subject {selectedSubject ? `· ${selectedSubject.title}` : needsSubject ? '(required)' : ''}
            </span>
            <select
              className={`form-input${needsSubject ? ' attendance-input--required' : ''}`}
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              disabled={!selectedClassId || subjects.length === 0 || loadingStudents}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.title}</option>
              ))}
            </select>
          </label>
          <label className="attendance-filter">
            <span className="attendance-filter-label">Date</span>
            <div className="attendance-date-wrap">
              <Calendar size={16} className="attendance-date-icon" aria-hidden />
              <input
                className="form-input attendance-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </label>
        </div>

        {noClassesAvailable ? (
          <div className="attendance-alert attendance-alert--warning">
            <p>
              {isAdmin
                ? 'No classes exist yet. Create a class under Classes, assign students, and add teaching assignments with subjects.'
                : 'No classes are linked to your account. Ask an administrator to assign you under Teaching Assignments.'}
            </p>
          </div>
        ) : null}

        {canShowStudents ? (
          <>
            <div className="attendance-toolbar">
              <div className="attendance-search-wrap">
                <Search size={18} className="attendance-search-icon" aria-hidden />
                <input
                  type="search"
                  className="form-input attendance-search-input"
                  placeholder="Search students by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn attendance-mark-all-btn"
                onClick={markAllPresent}
                disabled={students.length === 0}
              >
                <Check size={16} />
                Mark All Present
              </button>
            </div>

            <div className="attendance-summary" aria-live="polite">
              <div className="attendance-summary-chip attendance-summary-chip--present">
                <span className="attendance-summary-value">{summary.present}</span>
                <span className="attendance-summary-label">Present</span>
              </div>
              <div className="attendance-summary-chip attendance-summary-chip--absent">
                <span className="attendance-summary-value">{summary.absent}</span>
                <span className="attendance-summary-label">Absent</span>
              </div>
              <div className="attendance-summary-chip attendance-summary-chip--late">
                <span className="attendance-summary-value">{summary.late}</span>
                <span className="attendance-summary-label">Late</span>
              </div>
              <div className="attendance-summary-chip attendance-summary-chip--total">
                <Users size={16} aria-hidden />
                <span className="attendance-summary-value">{summary.total}</span>
                <span className="attendance-summary-label">Total</span>
              </div>
            </div>

            {loadingStudents || loadingRecords ? (
              <div className="attendance-loading">
                <div className="spinner" />
                <p>Loading students…</p>
              </div>
            ) : subjects.length === 0 ? (
              <div className="attendance-empty">
                <p>No subjects are linked to this class. Add a teaching assignment (class + subject + teacher) first.</p>
              </div>
            ) : students.length === 0 ? (
              <div className="attendance-empty">
                <Users size={32} strokeWidth={1.5} />
                <p>No students assigned to this class yet. Assign students from the Classes page.</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="attendance-empty">
                <Search size={32} strokeWidth={1.5} />
                <p>No students match &ldquo;{search}&rdquo;.</p>
              </div>
            ) : (
              <ul className="attendance-student-list">
                {filteredStudents.map((student) => {
                  const current = getStatus(student.id)
                  return (
                    <li key={student.id} className="attendance-student-card">
                      <div className="attendance-student-meta">
                        <StudentAvatar student={student} />
                        <div className="attendance-student-text">
                          <p className="attendance-student-name">{student.name}</p>
                          <p className="attendance-student-roll">{studentRollLabel(student)}</p>
                        </div>
                      </div>
                      <div
                        className="attendance-status-group"
                        role="group"
                        aria-label={`Attendance for ${student.name}`}
                      >
                        {MARKING_STATUSES.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`attendance-status-btn attendance-status-btn--${option.tone} ${
                              current === option.value ? 'is-active' : ''
                            }`}
                            aria-pressed={current === option.value}
                            onClick={() => setStatus(student.id, option.value)}
                          >
                            <span className="attendance-status-emoji" aria-hidden>{option.emoji}</span>
                            <span className="attendance-status-label">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="attendance-mobile-save">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </>
        ) : !noClassesAvailable ? (
          <div className="attendance-empty attendance-empty--prompt">
            <Calendar size={36} strokeWidth={1.5} />
            <p>
              <strong>Step 1:</strong> open the <strong>Class</strong> dropdown above and pick a class.
            </p>
          </div>
        ) : null}
      </form>
    </section>
  )
}
