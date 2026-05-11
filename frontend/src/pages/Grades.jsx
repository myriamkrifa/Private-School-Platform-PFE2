import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  bulkUpsertGrades,
  exportStudentGrades,
  getMyChildren,
  getStudentAverage,
  getStudentGrades,
  getTeacherClasses,
  getTeacherClassStudents,
  getTeacherClassSubjects
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

const GRADE_TYPES = ['TEST', 'EXAM', 'HOMEWORK', 'ORAL', 'PROJECT']

export default function Grades() {
  const { user } = useAuth()

  // Teacher entry state
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [evaluation, setEvaluation] = useState({
    title: '',
    type: 'TEST',
    date: new Date().toISOString().slice(0, 10)
  })
  const [gradeMap, setGradeMap] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Read state (parents/students/all)
  const [studentId, setStudentId] = useState('')
  const [children, setChildren] = useState([])
  const [grades, setGrades] = useState([])
  const [average, setAverage] = useState(null)

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
        if (user?.role === 'STUDENT') {
          // Use student dashboard? simpler: rely on /students/me/profile via /students/:id with id from /auth/me + studentId in localStorage if any.
          // We attempt to find studentId from /grades/student requires actual id. Skip until known.
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to initialize grades view.')
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
        setSelectedCourseId('')
        setGradeMap({})
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load class details.')
      }
    }
    load()
  }, [selectedClassId, user?.role])

  const loadGradesForStudent = async (id) => {
    if (!id) return
    setError('')
    try {
      const [gRes, aRes] = await Promise.all([
        getStudentGrades(id),
        getStudentAverage(id)
      ])
      setGrades(gRes.data?.data || [])
      setAverage(aRes.data || null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load grades.')
    }
  }

  useEffect(() => {
    if (studentId) loadGradesForStudent(studentId)
  }, [studentId])

  const submitGrade = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!selectedClassId || !selectedCourseId) {
      setError('Select class and subject first.')
      return
    }
    if (!evaluation.title.trim()) {
      setError('Provide an evaluation title.')
      return
    }
    const entries = students
      .filter((student) => gradeMap[student.id] !== undefined && gradeMap[student.id] !== '')
      .map((student) => ({
        studentId: student.id,
        score: Number(gradeMap[student.id])
      }))

    if (entries.length === 0) {
      setError('Enter at least one score.')
      return
    }
    if (entries.some((entry) => !Number.isFinite(entry.score) || entry.score < 0 || entry.score > 20)) {
      setError('All grades must be between 0 and 20.')
      return
    }

    setSubmitting(true)
    try {
      await bulkUpsertGrades({
        classId: Number(selectedClassId),
        courseId: Number(selectedCourseId),
        title: evaluation.title.trim(),
        type: evaluation.type,
        date: evaluation.date,
        grades: entries
      })
      setSuccess(`Saved ${entries.length} grade(s).`)
      setGradeMap({})
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save grades.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = async () => {
    if (!studentId) return
    try {
      const response = await exportStudentGrades(studentId)
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `student-${studentId}-grades.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export grades.')
    }
  }

  const subtitle = useMemo(() => {
    if (user?.role === 'TEACHER') return 'Enter grades by class and subject (0–20 scale).'
    if (user?.role === 'PARENT') return "View your children's grades and exports."
    return 'View grade history.'
  }, [user?.role])

  return (
    <DashboardShell title="Grades" subtitle={subtitle}>
      <div className="space-y-4">
        {user?.role === 'TEACHER' ? (
          <section className="page-card">
            <form onSubmit={submitGrade} className="page-card">
              <h3>New Evaluation</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                  placeholder="Evaluation title (e.g. Algebra Quiz)"
                  value={evaluation.title}
                  onChange={(e) => setEvaluation((prev) => ({ ...prev, title: e.target.value }))}
                />
                <select
                  className="form-input"
                  value={evaluation.type}
                  onChange={(e) => setEvaluation((prev) => ({ ...prev, type: e.target.value }))}
                >
                  {GRADE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input
                  className="form-input"
                  type="date"
                  value={evaluation.date}
                  onChange={(e) => setEvaluation((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <table className="data-table">
                <thead>
                  <tr><th>Student</th><th>Grade (0–20)</th></tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr><td colSpan={2}>Select a class to load students.</td></tr>
                  ) : students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          max="20"
                          step="0.25"
                          value={gradeMap[student.id] ?? ''}
                          onChange={(e) => setGradeMap((prev) => ({ ...prev, [student.id]: e.target.value }))}
                        />
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
                {submitting ? 'Saving…' : 'Save Grades'}
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
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  placeholder="Student ID to view"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
              )}
              <button className="btn btn-primary" type="button" onClick={() => loadGradesForStudent(studentId)}>
                Load Grades
              </button>
              {(user?.role === 'ADMIN' || user?.role === 'TEACHER' || user?.role === 'PARENT') ? (
                <button className="btn" type="button" onClick={handleExport} disabled={!studentId}>
                  Export CSV
                </button>
              ) : null}
            </div>
            {average ? (
              <p className="mt-2 text-sm">
                Overall average: <strong>{average.average ?? '—'}</strong>{' '}
                · Weighted: <strong>{average.weightedAverage ?? '—'}</strong>{' '}
                · Total grades: {average.count}
              </p>
            ) : null}
            {error && user?.role !== 'TEACHER' ? <p className="field-error">{error}</p> : null}
          </div>

          <div className="page-table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Title</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {grades.length === 0 ? (
                  <tr><td colSpan={5}>No grades to display.</td></tr>
                ) : grades.map((grade) => (
                  <tr key={grade.id}>
                    <td>{grade.course?.title || grade.subject}</td>
                    <td>{grade.type}</td>
                    <td>{grade.score}/{grade.maxScore || 20}</td>
                    <td>{grade.title || '-'}</td>
                    <td>{new Date(grade.recordedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
