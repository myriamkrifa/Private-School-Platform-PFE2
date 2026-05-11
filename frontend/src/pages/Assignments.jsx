import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  createAssignment,
  getAllCourses,
  getAssignmentSubmissions,
  getCourseAssignments,
  getMyChildren,
  getTeacherClasses,
  getTeacherClassStudents,
  getTeacherClassSubjects,
  submitAssignment
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

const initialCreateForm = {
  classId: '',
  courseId: '',
  title: '',
  description: '',
  dueDate: '',
  targetType: 'FULL_CLASS',
  studentIds: []
}

export default function Assignments() {
  const { user } = useAuth()
  const isTeacher = user?.role === 'TEACHER'
  const isStudent = user?.role === 'STUDENT'

  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [allCourses, setAllCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [courseId, setCourseId] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [submitForm, setSubmitForm] = useState({ assignmentId: '', content: '', fileUrl: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        if (isTeacher) {
          const response = await getTeacherClasses()
          setClasses(response.data?.data || [])
        }
        const courses = await getAllCourses()
        setAllCourses(courses.data?.data || [])
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to initialize assignments view.')
      }
    }
    load()
  }, [isTeacher])

  useEffect(() => {
    const load = async () => {
      if (!createForm.classId || !isTeacher) return
      try {
        const [studentsRes, subjectsRes] = await Promise.all([
          getTeacherClassStudents(createForm.classId),
          getTeacherClassSubjects(createForm.classId)
        ])
        setStudents(studentsRes.data?.data || [])
        setSubjects(subjectsRes.data?.data || [])
        setCreateForm((prev) => ({ ...prev, courseId: '', studentIds: [] }))
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load class.')
      }
    }
    load()
  }, [createForm.classId, isTeacher])

  const loadAssignments = async (id) => {
    if (!id) return
    setError('')
    try {
      const response = await getCourseAssignments(id)
      setAssignments(response.data?.data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assignments.')
    }
  }

  const loadSubmissions = async (id) => {
    if (!id) return
    setError('')
    try {
      const response = await getAssignmentSubmissions(id)
      setSubmissions(response.data?.data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load submissions.')
    }
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      await createAssignment({
        classId: Number(createForm.classId),
        courseId: Number(createForm.courseId),
        title: createForm.title.trim(),
        description: createForm.description,
        dueDate: createForm.dueDate,
        targetType: createForm.targetType,
        studentIds: createForm.targetType === 'SELECTED_STUDENTS'
          ? createForm.studentIds.map(Number)
          : []
      })
      setCreateForm(initialCreateForm)
      setSuccess('Assignment created.')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create assignment.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitAssignment = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    try {
      await submitAssignment(submitForm.assignmentId, {
        content: submitForm.content,
        fileUrl: submitForm.fileUrl
      })
      setSubmitForm({ assignmentId: '', content: '', fileUrl: '' })
      setSuccess('Submission saved.')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit assignment.')
    }
  }

  return (
    <DashboardShell title="Assignments" subtitle="Create assignments and review submissions.">
      <div className="space-y-4">
        {isTeacher ? (
          <section className="page-card">
            <form onSubmit={handleCreate} className="page-card">
              <h3>Create Assignment</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  className="form-input"
                  value={createForm.classId}
                  onChange={(e) => setCreateForm({ ...createForm, classId: e.target.value })}
                >
                  <option value="">Select class</option>
                  {classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
                </select>
                <select
                  className="form-input"
                  value={createForm.courseId}
                  onChange={(e) => setCreateForm({ ...createForm, courseId: e.target.value })}
                >
                  <option value="">Select subject</option>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
                </select>
                <input
                  className="form-input"
                  placeholder="Title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                />
                <input
                  className="form-input"
                  type="datetime-local"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                />
                <select
                  className="form-input"
                  value={createForm.targetType}
                  onChange={(e) => setCreateForm({ ...createForm, targetType: e.target.value })}
                >
                  <option value="FULL_CLASS">Full class</option>
                  <option value="SELECTED_STUDENTS">Selected students</option>
                </select>
              </div>
              <textarea
                className="form-input"
                placeholder="Description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
              {createForm.targetType === 'SELECTED_STUDENTS' ? (
                <select
                  className="form-input"
                  multiple
                  value={createForm.studentIds.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((option) => Number(option.value))
                    setCreateForm({ ...createForm, studentIds: selected })
                  }}
                >
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              ) : null}
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create'}
              </button>
              {error ? <p className="field-error">{error}</p> : null}
              {success ? <p style={{ color: 'var(--success)' }}>{success}</p> : null}
            </form>
          </section>
        ) : null}

        <section className="page-card">
          <h3>Assignments by Subject</h3>
          <div className="page-card">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                className="form-input"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">Select subject</option>
                {allCourses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <button className="btn btn-primary" type="button" onClick={() => loadAssignments(courseId)}>
                Load assignments
              </button>
            </div>
          </div>
          <div className="page-table-card">
            <table className="data-table">
              <thead>
                <tr><th>Title</th><th>Class</th><th>Due Date</th><th>Target</th></tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr><td colSpan={4}>No assignments to display.</td></tr>
                ) : assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{a.class?.name || '-'}</td>
                    <td>{new Date(a.dueDate).toLocaleString()}</td>
                    <td>{a.targetType === 'FULL_CLASS' ? 'Full class' : `Selected (${a.recipients?.length || 0})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {isStudent ? (
          <section className="page-card">
            <form onSubmit={handleSubmitAssignment} className="page-card">
              <h3>Submit assignment</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  className="form-input"
                  placeholder="Assignment ID"
                  value={submitForm.assignmentId}
                  onChange={(e) => setSubmitForm({ ...submitForm, assignmentId: e.target.value })}
                />
                <input
                  className="form-input md:col-span-2"
                  placeholder="File URL (optional)"
                  value={submitForm.fileUrl}
                  onChange={(e) => setSubmitForm({ ...submitForm, fileUrl: e.target.value })}
                />
              </div>
              <textarea
                className="form-input"
                placeholder="Your answer / comment"
                value={submitForm.content}
                onChange={(e) => setSubmitForm({ ...submitForm, content: e.target.value })}
              />
              <button className="btn btn-primary" type="submit">Submit</button>
            </form>
          </section>
        ) : null}

        {(user?.role === 'ADMIN' || isTeacher) ? (
          <section className="page-card">
            <h3>Submissions per assignment</h3>
            <div className="page-card">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  className="form-input"
                  placeholder="Assignment ID"
                  value={assignmentId}
                  onChange={(e) => setAssignmentId(e.target.value)}
                />
                <button className="btn btn-primary" type="button" onClick={() => loadSubmissions(assignmentId)}>
                  Load submissions
                </button>
              </div>
            </div>
            <div className="page-table-card">
              <table className="data-table">
                <thead>
                  <tr><th>Student</th><th>Submitted At</th><th>Content</th><th>File</th></tr>
                </thead>
                <tbody>
                  {submissions.length === 0 ? (
                    <tr><td colSpan={4}>No submissions yet.</td></tr>
                  ) : submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td>{submission.student?.name || `#${submission.studentId}`}</td>
                      <td>{new Date(submission.submittedAt).toLocaleString()}</td>
                      <td>{submission.content || '-'}</td>
                      <td>
                        {submission.fileUrl ? (
                          <a href={submission.fileUrl} target="_blank" rel="noreferrer">Open</a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </DashboardShell>
  )
}
