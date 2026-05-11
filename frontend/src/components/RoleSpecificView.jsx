import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  FileUp,
  GraduationCap,
  Loader2,
  Megaphone,
  MessageCircle,
  Pencil,
  Shield,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  Wallet,
  XCircle
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { jsPDF } from 'jspdf'
import { useAuth } from '../context/AuthContext'
import API, {
  createAnnouncement,
  createGrade,
  createStudent,
  exportStudentGrades,
  getAcademicYears,
  getAllClasses,
  getAllCourses,
  getAllStudents,
  getAllTeachers,
  getAllUsers,
  getAnnouncements,
  getCourseAssignments,
  getInboxMessages,
  getMyNotifications,
  getStudentAttendance,
  getStudentById,
  getStudentGrades,
  linkParentToStudent,
  markAttendance,
  registerUser,
  sendMessage,
  updateAcademicYear
} from '../services/auth.service'

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'

const statusTone = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  JUSTIFIED: 'bg-sky-100 text-sky-700'
}

function LoadingShimmer({ rows = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-4 animate-pulse rounded bg-slate-200" />
      ))}
    </div>
  )
}

function EmptyState({ title, description, icon: Icon = AlertCircle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <Icon size={24} className="mb-2 text-slate-400" />
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  )
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="rounded-md bg-sky-100 p-2 text-sky-700">
        <Icon size={16} />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const tone = statusTone[status] || 'bg-slate-100 text-slate-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>[{status}]</span>
}

function DoubleConfirmModal({ open, title, detail, onClose, onConfirm }) {
  const [step, setStep] = useState(1)

  useEffect(() => {
    if (!open) setStep(1)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
        <h4 className="text-base font-semibold">{title}</h4>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancel</button>
          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white"
            >
              Confirm Step 1
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
            >
              Confirm Step 2
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StudentDashboard({ user }) {
  const [loading, setLoading] = useState(true)
  const [studentData, setStudentData] = useState(null)
  const [grades, setGrades] = useState([])
  const [assignments, setAssignments] = useState([])
  const [classmates, setClassmates] = useState([])
  const [goalInputs, setGoalInputs] = useState([{ subject: '', score: '' }])
  const [privacyMode, setPrivacyMode] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const studentId = Number.parseInt(localStorage.getItem('studentId') || '', 10)
        if (!Number.isInteger(studentId) || studentId <= 0) {
          setLoading(false)
          return
        }

        const [profileRes, gradesRes, studentsRes, coursesRes] = await Promise.all([
          getStudentById(studentId),
          getStudentGrades(studentId),
          getAllStudents(),
          getAllCourses()
        ])

        const profile = profileRes.data?.data || null
        setStudentData(profile)
        setGrades(gradesRes.data?.data || [])
        setClassmates((studentsRes.data?.data || []).filter((s) => s.id !== studentId))

        const classIds = (profile?.classes || []).map((c) => c.id)
        const relatedCourses = (coursesRes.data?.data || []).filter((course) => classIds.includes(course.class?.id))
        const assignmentsByCourse = await Promise.all(
          relatedCourses.map(async (course) => {
            try {
              const response = await getCourseAssignments(course.id)
              return response.data?.data || []
            } catch (_error) {
              return []
            }
          })
        )

        setAssignments(assignmentsByCourse.flat())
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const trendData = useMemo(() => {
    return grades
      .slice()
      .reverse()
      .map((grade, index) => ({ label: `Eval ${index + 1}`, score: Number(grade.score || 0) }))
  }, [grades])

  const currentGpa = useMemo(() => {
    if (!grades.length) return 0
    const sum = grades.reduce((acc, grade) => acc + Number(grade.score || 0), 0)
    return Number((sum / grades.length).toFixed(2))
  }, [grades])

  const projectedGpa = useMemo(() => {
    const targets = goalInputs
      .map((item) => Number(item.score))
      .filter((value) => Number.isFinite(value) && value >= 0)

    if (!targets.length) return currentGpa
    const currentTotal = grades.reduce((acc, grade) => acc + Number(grade.score || 0), 0)
    const combined = currentTotal + targets.reduce((a, b) => a + b, 0)
    return Number((combined / (grades.length + targets.length)).toFixed(2))
  }, [goalInputs, grades, currentGpa])

  const upcomingDeadlines = useMemo(() => {
    const now = new Date()
    const max = new Date(now)
    max.setDate(now.getDate() + 7)

    return assignments
      .filter((item) => {
        const due = new Date(item.dueDate)
        return due >= now && due <= max
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [assignments])

  const addGoalRow = () => {
    setGoalInputs((prev) => [...prev, { subject: '', score: '' }])
  }

  const updateGoalRow = (index, key, value) => {
    setGoalInputs((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const downloadReportCard = () => {
    if (!studentData) return
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Private School Platform - Report Card', 14, 16)
    doc.setFontSize(11)
    doc.text(`Student: ${studentData.name}`, 14, 28)
    doc.text(`Grade Level: ${studentData.grade}`, 14, 35)
    doc.text(`Current GPA: ${currentGpa}`, 14, 42)

    let y = 54
    grades.forEach((grade) => {
      doc.text(`${grade.subject}: ${grade.score}/${grade.maxScore}`, 14, y)
      y += 7
    })

    doc.save(`report-card-${studentData.id}.pdf`)
  }

  if (loading) {
    return (
      <div className={cardClass}>
        <LoadingShimmer rows={10} />
      </div>
    )
  }

  if (!studentData) {
    return (
      <EmptyState
        title="Student profile not linked"
        description="Set localStorage studentId after login to enable personal planner widgets."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${cardClass} lg:col-span-2`}>
          <SectionTitle icon={GraduationCap} title="My Grades" subtitle="GPA trend and performance analytics" />
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-slate-500">Current GPA</p>
            <p className="text-2xl font-bold">{currentGpa || 'N/A'}</p>
          </div>
          {trendData.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={[0, 20]} />
                  <Tooltip />
                  <Line dataKey="score" stroke="#0284c7" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No grades posted yet" description="Your grade chart appears when evaluations are submitted." />
          )}
        </div>

        <div className={cardClass}>
          <SectionTitle icon={Clock3} title="Upcoming Deadlines" subtitle="Next 7 days" />
          {upcomingDeadlines.length ? (
            <ul className="space-y-2 text-sm">
              {upcomingDeadlines.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 p-2">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-slate-500">Due: {new Date(item.dueDate).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No upcoming deadlines" description="No assignments due in the next 7 days." icon={Calendar} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <SectionTitle icon={TrendingUp} title="GPA Goal Setter" subtitle="Estimate GPA using target exam scores" />
          <div className="space-y-2">
            {goalInputs.map((row, index) => (
              <div key={index} className="grid grid-cols-2 gap-2">
                <input
                  value={row.subject}
                  onChange={(event) => updateGoalRow(index, 'subject', event.target.value)}
                  placeholder="Subject"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={row.score}
                  onChange={(event) => updateGoalRow(index, 'score', event.target.value)}
                  placeholder="Target score"
                  type="number"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
            <button type="button" onClick={addGoalRow} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Add Target</button>
            <p className="text-sm text-slate-700">Projected GPA: <span className="font-semibold">{projectedGpa}</span></p>
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={Download} title="Report Card" subtitle="Export semester grades as PDF" />
          <button
            type="button"
            onClick={downloadReportCard}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Download size={14} />
            Generate PDF
          </button>
        </div>
      </div>

      <div className={cardClass}>
        <SectionTitle icon={Users} title="Classmate Directory" subtitle="Privacy mode enabled by default" />
        <label className="mb-3 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={privacyMode} onChange={(event) => setPrivacyMode(event.target.checked)} />
          Privacy mode
        </label>
        {classmates.length ? (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {classmates.slice(0, 12).map((mate) => (
              <li key={mate.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                <p className="font-medium">{mate.name}</p>
                <p className="text-xs text-slate-500">
                  {privacyMode ? 'Contact hidden (authorized view required)' : mate.email}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No classmates found" description="Directory will be available once class roster is synced." />
        )}
      </div>
    </div>
  )
}

function TeacherDashboard({ user }) {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [attendanceMap, setAttendanceMap] = useState({})
  const [attendanceHistory, setAttendanceHistory] = useState([])
  const [gradeForm, setGradeForm] = useState({ studentId: '', subject: '', score: '', maxScore: 20 })
  const [gradeEntries, setGradeEntries] = useState([])
  const [teacherCourses, setTeacherCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [resourceLink, setResourceLink] = useState('')
  const [resourcesByCourse, setResourcesByCourse] = useState({})
  const [selectedStudentForNote, setSelectedStudentForNote] = useState('')
  const [noteText, setNoteText] = useState('')
  const [notes, setNotes] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [classesRes, studentsRes, coursesRes] = await Promise.all([getAllClasses(), getAllStudents(), getAllCourses()])
        const assignedClasses = (classesRes.data?.data || []).filter(
          (item) => item.teacher?.name?.toLowerCase() === user?.name?.toLowerCase()
        )

        setClasses(assignedClasses)
        setSelectedClassId(assignedClasses[0]?.id ? String(assignedClasses[0].id) : '')
        setStudents(studentsRes.data?.data || [])

        const teacherCoursesList = (coursesRes.data?.data || []).filter(
          (course) => course.teacher?.id === user?.id || course.teacher?.name?.toLowerCase() === user?.name?.toLowerCase()
        )
        setTeacherCourses(teacherCoursesList)
        setSelectedCourseId(teacherCoursesList[0]?.id ? String(teacherCoursesList[0].id) : '')

        const attendanceResults = await Promise.all(
          (studentsRes.data?.data || []).slice(0, 15).map(async (student) => {
            try {
              const response = await getStudentAttendance(student.id)
              return response.data?.data || []
            } catch (_error) {
              return []
            }
          })
        )

        setAttendanceHistory(attendanceResults.flat())
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id, user?.name])

  const canWrite = user?.role === 'TEACHER' && Boolean(selectedClassId)

  const heatmapData = useMemo(() => {
    const grouped = {}
    attendanceHistory.forEach((record) => {
      const key = new Date(record.date).toISOString().slice(0, 10)
      if (!grouped[key]) grouped[key] = { date: key, absent: 0, present: 0 }
      if (record.status === 'ABSENT') grouped[key].absent += 1
      if (record.status === 'PRESENT') grouped[key].present += 1
    })

    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-14)
  }, [attendanceHistory])

  const gradeStats = useMemo(() => {
    const values = gradeEntries.map((entry) => Number(entry.score)).filter((value) => Number.isFinite(value))
    if (!values.length) return { mean: 0, median: 0, mode: 0 }

    const sorted = values.slice().sort((a, b) => a - b)
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]

    const freq = {}
    sorted.forEach((value) => {
      freq[value] = (freq[value] || 0) + 1
    })

    let mode = sorted[0]
    let maxFreq = 0
    Object.entries(freq).forEach(([value, count]) => {
      if (count > maxFreq) {
        maxFreq = count
        mode = Number(value)
      }
    })

    return {
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      mode
    }
  }, [gradeEntries])

  const handleAttendanceSave = async (studentId) => {
    if (!canWrite) return
    const selected = attendanceMap[studentId] || 'PRESENT'
    const status = selected === 'JUSTIFIED' ? 'ABSENT' : selected
    await markAttendance({
      studentId,
      date: new Date().toISOString(),
      status,
      justification: selected === 'JUSTIFIED' ? 'Teacher marked as justified.' : null
    })
  }

  const submitGrade = async (event) => {
    event.preventDefault()
    if (!canWrite || !gradeForm.studentId) return

    const payload = {
      studentId: Number(gradeForm.studentId),
      subject: gradeForm.subject,
      score: Number(gradeForm.score),
      maxScore: Number(gradeForm.maxScore)
    }

    await createGrade(payload)
    setGradeEntries((prev) => [...prev, payload])
    setGradeForm({ studentId: '', subject: '', score: '', maxScore: 20 })
  }

  const onResourceDrop = (event) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files || [])
    if (!files.length || !selectedCourseId) return

    setResourcesByCourse((prev) => {
      const existing = prev[selectedCourseId] || []
      return {
        ...prev,
        [selectedCourseId]: [
          ...existing,
          ...files.map((file) => ({ id: `${file.name}-${Date.now()}`, type: 'file', name: file.name, size: file.size }))
        ]
      }
    })
  }

  const addLinkResource = () => {
    if (!resourceLink.trim() || !selectedCourseId) return

    setResourcesByCourse((prev) => {
      const existing = prev[selectedCourseId] || []
      return {
        ...prev,
        [selectedCourseId]: [...existing, { id: `link-${Date.now()}`, type: 'link', name: resourceLink.trim() }]
      }
    })
    setResourceLink('')
  }

  const addBehaviorNote = () => {
    if (!selectedStudentForNote || !noteText.trim()) return
    setNotes((prev) => [
      ...prev,
      {
        id: Date.now(),
        studentId: Number(selectedStudentForNote),
        text: noteText.trim(),
        createdAt: new Date().toISOString(),
        private: true
      }
    ])
    setNoteText('')
  }

  if (loading) {
    return (
      <div className={cardClass}>
        <LoadingShimmer rows={10} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <SectionTitle icon={Calendar} title="Attendance Tracker" subtitle="Classroom Manager write panel" />
          {classes.length ? (
            <select
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name} - {item.room}</option>
              ))}
            </select>
          ) : null}

          {students.length ? (
            <div className="space-y-2">
              {students.slice(0, 8).map((student) => (
                <div key={student.id} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{student.name}</p>
                    <StatusBadge status={attendanceMap[student.id] || 'PRESENT'} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      disabled={!canWrite}
                      value={attendanceMap[student.id] || 'PRESENT'}
                      onChange={(event) => setAttendanceMap((prev) => ({ ...prev, [student.id]: event.target.value }))}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="PRESENT">PRESENT</option>
                      <option value="ABSENT">ABSENT</option>
                      <option value="JUSTIFIED">JUSTIFIED</option>
                    </select>
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => handleAttendanceSave(student.id)}
                      className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No students found" description="Assign students to class to begin attendance tracking." />
          )}
        </div>

        <div className={cardClass}>
          <SectionTitle icon={TrendingUp} title="Attendance Heatmap" subtitle="Identify absenteeism patterns" />
          {heatmapData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmapData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" hide />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#22c55e" />
                  <Bar dataKey="absent" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No attendance history" description="Heatmap appears once records are available." icon={Calendar} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <SectionTitle icon={Pencil} title="Grade Entry" subtitle="Automatic Mean, Median, Mode" />
          <form onSubmit={submitGrade} className="space-y-2">
            <select
              value={gradeForm.studentId}
              disabled={!canWrite}
              onChange={(event) => setGradeForm((prev) => ({ ...prev, studentId: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select student</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
            <input
              value={gradeForm.subject}
              disabled={!canWrite}
              onChange={(event) => setGradeForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Subject"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={gradeForm.score}
                disabled={!canWrite}
                type="number"
                onChange={(event) => setGradeForm((prev) => ({ ...prev, score: event.target.value }))}
                placeholder="Score"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={gradeForm.maxScore}
                disabled={!canWrite}
                type="number"
                onChange={(event) => setGradeForm((prev) => ({ ...prev, maxScore: event.target.value }))}
                placeholder="Max"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={!canWrite} className="rounded-lg bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-40">Save Grade</button>
              <button
                type="button"
                disabled={!gradeForm.studentId}
                onClick={() => exportStudentGrades(gradeForm.studentId)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </form>

          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-slate-100 p-2">Mean: <span className="font-semibold">{gradeStats.mean}</span></div>
            <div className="rounded-lg bg-slate-100 p-2">Median: <span className="font-semibold">{gradeStats.median}</span></div>
            <div className="rounded-lg bg-slate-100 p-2">Mode: <span className="font-semibold">{gradeStats.mode}</span></div>
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={FileUp} title="Resource Repository" subtitle="Drag files or add PDF/YouTube links" />
          {teacherCourses.length ? (
            <select
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {teacherCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          ) : null}

          <div
            onDrop={onResourceDrop}
            onDragOver={(event) => event.preventDefault()}
            className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center"
          >
            <Upload className="mx-auto mb-2 text-slate-400" size={20} />
            <p className="text-sm text-slate-600">Drag and drop resources here</p>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={resourceLink}
              onChange={(event) => setResourceLink(event.target.value)}
              placeholder="Paste YouTube or PDF link"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={addLinkResource} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Add</button>
          </div>

          {(resourcesByCourse[selectedCourseId] || []).length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {(resourcesByCourse[selectedCourseId] || []).map((resource) => (
                <li key={resource.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                  <span className="truncate">{resource.name}</span>
                  <button
                    type="button"
                    className="text-xs text-rose-600"
                    onClick={() => setDeleteTarget({ type: 'resource', id: resource.id, courseId: selectedCourseId })}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className={cardClass}>
        <SectionTitle icon={UserRound} title="Behavioral Notes" subtitle="Private soft-skills tracker for parent-teacher meetings" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <select
            value={selectedStudentForNote}
            onChange={(event) => setSelectedStudentForNote(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select student</option>
            {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
          </select>
          <input
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Participation, collaboration, behavior notes..."
          />
        </div>
        <button type="button" onClick={addBehaviorNote} className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Save Private Note</button>

        {notes.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {notes.map((note) => (
              <li key={note.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                <div>
                  <p className="font-medium">Student #{note.studentId}</p>
                  <p className="text-slate-600">{note.text}</p>
                </div>
                <button type="button" className="text-xs text-rose-600" onClick={() => setDeleteTarget({ type: 'note', id: note.id })}>Delete</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No notes yet.</p>
        )}
      </div>

      <DoubleConfirmModal
        open={Boolean(deleteTarget)}
        title="Confirm deletion"
        detail="This delete action requires double confirmation."
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          if (deleteTarget.type === 'resource') {
            setResourcesByCourse((prev) => ({
              ...prev,
              [deleteTarget.courseId]: (prev[deleteTarget.courseId] || []).filter((res) => res.id !== deleteTarget.id)
            }))
          }
          if (deleteTarget.type === 'note') {
            setNotes((prev) => prev.filter((note) => note.id !== deleteTarget.id))
          }
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}

function ParentDashboard() {
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [teacherDirectory, setTeacherDirectory] = useState([])
  const [alerts, setAlerts] = useState([])
  const [comparison, setComparison] = useState({ childAverage: 0, classAverage: 0 })
  const [messageModalOpen, setMessageModalOpen] = useState(false)
  const [messagePayload, setMessagePayload] = useState({ recipientId: '', content: '' })

  useEffect(() => {
    const load = async () => {
      try {
        const childIds = JSON.parse(localStorage.getItem('parentChildrenIds') || '[]')
        const normalizedIds = Array.isArray(childIds)
          ? childIds.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0)
          : []

        const profiles = await Promise.all(
          normalizedIds.map(async (id) => {
            const [profileRes, gradesRes, attendanceRes] = await Promise.all([
              getStudentById(id),
              getStudentGrades(id),
              getStudentAttendance(id)
            ])

            return {
              id,
              profile: profileRes.data?.data || null,
              grades: gradesRes.data?.data || [],
              attendance: attendanceRes.data?.data || []
            }
          })
        )

        setChildren(profiles)
        setSelectedChildId(String(profiles[0]?.id || ''))

        const [coursesRes, notificationsRes] = await Promise.all([getAllCourses(), getMyNotifications()])
        const courseList = coursesRes.data?.data || []

        const teacherMap = new Map()
        profiles.forEach((child) => {
          const childClassIds = (child.profile?.classes || []).map((klass) => klass.id)
          courseList
            .filter((course) => childClassIds.includes(course.class?.id) && course.teacher)
            .forEach((course) => {
              teacherMap.set(course.teacher.id, {
                id: course.teacher.id,
                name: course.teacher.name,
                email: course.teacher.email,
                course: course.title
              })
            })
        })

        const teacherList = Array.from(teacherMap.values())
        setTeacherDirectory(teacherList)
        setMessagePayload((prev) => ({ ...prev, recipientId: teacherList[0] ? String(teacherList[0].id) : '' }))

        const highPriority = (notificationsRes.data?.data || []).filter(
          (item) => item.type === 'ABSENCE' || item.type === 'GRADE'
        )
        setAlerts(highPriority)

        const allStudentProfiles = await Promise.all(
          normalizedIds.slice(0, 1).map(async (id) => {
            const gradesRes = await getStudentGrades(id)
            return gradesRes.data?.data || []
          })
        )

        const selectedGrades = allStudentProfiles.flat()
        const childAverage = selectedGrades.length
          ? selectedGrades.reduce((acc, grade) => acc + Number(grade.score || 0), 0) / selectedGrades.length
          : 0

        const allStudentsRes = await getAllStudents()
        const sampleIds = (allStudentsRes.data?.data || []).slice(0, 8).map((student) => student.id)
        const sampleGrades = await Promise.all(sampleIds.map(async (id) => (await getStudentGrades(id)).data?.data || []))
        const flat = sampleGrades.flat()
        const classAverage = flat.length
          ? flat.reduce((acc, grade) => acc + Number(grade.score || 0), 0) / flat.length
          : 0

        setComparison({
          childAverage: Number(childAverage.toFixed(2)),
          classAverage: Number(classAverage.toFixed(2))
        })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const selectedChild = useMemo(
    () => children.find((child) => String(child.id) === selectedChildId) || null,
    [children, selectedChildId]
  )

  const latestGrades = useMemo(() => {
    if (!selectedChild) return []
    return selectedChild.grades
      .slice()
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
      .slice(0, 5)
  }, [selectedChild])

  const todaysAttendance = useMemo(() => {
    if (!selectedChild) return null
    const today = new Date().toISOString().slice(0, 10)
    return selectedChild.attendance.find((record) => new Date(record.date).toISOString().slice(0, 10) === today) || null
  }, [selectedChild])

  const sendDirectMessage = async () => {
    if (!messagePayload.recipientId || !messagePayload.content.trim()) return
    await sendMessage({
      recipientId: Number(messagePayload.recipientId),
      content: messagePayload.content.trim()
    })
    setMessagePayload((prev) => ({ ...prev, content: '' }))
    setMessageModalOpen(false)
  }

  if (loading) {
    return (
      <div className={cardClass}>
        <LoadingShimmer rows={10} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <SectionTitle icon={Users} title="Sibling Toggle" subtitle="Support System observer mode" />
        {children.length ? (
          <div className="flex flex-wrap gap-2">
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => setSelectedChildId(String(child.id))}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  String(child.id) === selectedChildId ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {child.profile?.name || `Child ${child.id}`}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No children linked"
            description="Set localStorage parentChildrenIds, for example [1,2], to activate sibling switching."
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${cardClass} lg:col-span-2`}>
          <SectionTitle icon={Clock3} title="Child Snapshot" subtitle="Latest grades and today attendance" />
          {selectedChild ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Today attendance</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold">{todaysAttendance?.status || 'No record today'}</span>
                  {todaysAttendance?.status ? <StatusBadge status={todaysAttendance.status} /> : null}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs text-slate-500">Latest grades</p>
                {latestGrades.length ? (
                  <ul className="space-y-2">
                    {latestGrades.map((grade) => (
                      <li key={grade.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-sm">
                        <span className="font-medium">{grade.subject}</span>
                        <span>{grade.score}/{grade.maxScore}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No grades posted yet</p>
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="Select a child" description="Choose a child to load dashboard data." />
          )}
        </div>

        <div className="space-y-4">
          <div className={cardClass}>
            <SectionTitle icon={Bell} title="Instant Notification Center" subtitle="High priority feed" />
            {alerts.length ? (
              <ul className="space-y-2 text-sm">
                {alerts.slice(0, 6).map((alert) => (
                  <li key={alert.id} className="rounded-lg border border-slate-200 p-2">
                    <p className="font-medium">{alert.type}</p>
                    <p className="text-xs text-slate-500">{alert.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No high priority alerts" description="Critical updates will appear here." icon={Bell} />
            )}
          </div>

          <div className={cardClass}>
            <SectionTitle icon={MessageCircle} title="Direct Message" subtitle="Contact teaching staff" />
            <button type="button" onClick={() => setMessageModalOpen(true)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
              Contact Teacher
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <SectionTitle icon={Users} title="Teacher Directory" subtitle="Only teachers linked to your children" />
          {teacherDirectory.length ? (
            <ul className="space-y-2 text-sm">
              {teacherDirectory.map((teacher) => (
                <li key={teacher.id} className="rounded-lg border border-slate-200 p-2">
                  <p className="font-medium">{teacher.name}</p>
                  <p className="text-xs text-slate-500">{teacher.course}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No teacher directory data" description="Teacher list appears when child course links are available." />
          )}
        </div>

        <div className={cardClass}>
          <SectionTitle icon={TrendingUp} title="Performance Comparison" subtitle="Child average vs class average" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { label: 'Child', value: comparison.childAverage },
                { label: 'Class Avg', value: comparison.classAverage }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 20]} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  <Cell fill="#0ea5e9" />
                  <Cell fill="#64748b" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {messageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h4 className="text-base font-semibold">Message Teacher</h4>
            <select
              value={messagePayload.recipientId}
              onChange={(event) => setMessagePayload((prev) => ({ ...prev, recipientId: event.target.value }))}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {teacherDirectory.length
                ? teacherDirectory.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)
                : <option value="">No teacher available</option>}
            </select>
            <textarea
              value={messagePayload.content}
              onChange={(event) => setMessagePayload((prev) => ({ ...prev, content: event.target.value }))}
              rows={5}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Write your message"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setMessageModalOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancel</button>
              <button type="button" onClick={sendDirectMessage} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [studentsCount, setStudentsCount] = useState(0)
  const [teachersCount, setTeachersCount] = useState(0)
  const [users, setUsers] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [roleModal, setRoleModal] = useState({ open: false, userId: null, role: '' })
  const [systemHealth, setSystemHealth] = useState({ status: 'unknown', message: 'No check yet' })
  const [auditLogs, setAuditLogs] = useState([])
  const [bulkSummary, setBulkSummary] = useState({ created: 0, failed: 0 })
  const [tuitionData, setTuitionData] = useState([])
  const [emergencyText, setEmergencyText] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [studentsRes, teachersRes, usersRes, yearsRes, healthRes] = await Promise.all([
          getAllStudents(),
          getAllTeachers(),
          getAllUsers(),
          getAcademicYears(),
          API.get('/health')
        ])

        const studentList = studentsRes.data?.data || []
        const teacherList = teachersRes.data?.data || []
        const userList = usersRes.data?.users || []
        const yearList = yearsRes.data?.data || []

        setStudentsCount(studentList.length)
        setTeachersCount(teacherList.length)
        setUsers(userList)
        setAcademicYears(yearList)
        setSystemHealth({
          status: healthRes.data?.status || 'unknown',
          message: healthRes.data?.message || 'No message'
        })

        const paid = Math.ceil(studentList.length * 0.68)
        const pending = Math.max(studentList.length - paid, 0)
        setTuitionData([
          { label: 'Paid', value: paid, color: '#22c55e' },
          { label: 'Pending', value: pending, color: '#f59e0b' }
        ])

        setAuditLogs(JSON.parse(localStorage.getItem('auditLogs') || '[]'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const pushAudit = (entry) => {
    setAuditLogs((prev) => {
      const next = [{ ...entry, at: new Date().toISOString() }, ...prev].slice(0, 40)
      localStorage.setItem('auditLogs', JSON.stringify(next))
      return next
    })
  }

  const simulatedRevenue = useMemo(() => `$${(studentsCount * 250).toLocaleString()}`, [studentsCount])

  const updateRole = async () => {
    if (!roleModal.userId || !roleModal.role) return

    const previous = users.find((user) => user.id === roleModal.userId)
    await API.patch(`/users/${roleModal.userId}/role`, { role: roleModal.role })
    setUsers((prev) => prev.map((user) => (user.id === roleModal.userId ? { ...user, role: roleModal.role } : user)))

    if (previous) {
      pushAudit({
        type: 'role_change',
        message: `${previous.name} role changed from ${previous.role} to ${roleModal.role}`
      })
    }

    setRoleModal({ open: false, userId: null, role: '' })
  }

  const toggleAcademicYear = async (year) => {
    await updateAcademicYear(year.id, { isActive: !year.isActive })
    setAcademicYears((prev) => prev.map((item) => ({ ...item, isActive: item.id === year.id ? !year.isActive : false })))
    pushAudit({
      type: 'academic_year_toggle',
      message: `Academic year ${year.name} set to ${!year.isActive ? 'ACTIVE' : 'INACTIVE'}`
    })
  }

  const publishEmergency = async () => {
    if (!emergencyText.trim()) return
    await createAnnouncement({
      title: `[EMERGENCY] ${emergencyText.trim().slice(0, 42)}`,
      content: emergencyText.trim()
    })
    localStorage.setItem('globalEmergencyBanner', emergencyText.trim())
    pushAudit({ type: 'broadcast', message: 'Emergency broadcast published globally.' })
    setEmergencyText('')
  }

  const parseCsvRows = (raw) => {
    const lines = raw.split(/\r?\n/).filter(Boolean)
    if (lines.length <= 1) return []
    const headers = lines[0].split(',').map((h) => h.trim())
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim())
      const row = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      return row
    })
  }

  const handleBulkFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const rows = parseCsvRows(text)

    let created = 0
    let failed = 0

    for (const row of rows) {
      try {
        const studentUser = await registerUser({
          name: row.studentName,
          email: row.studentEmail,
          password: row.studentPassword || 'student123',
          role: 'STUDENT'
        })

        const parentUser = await registerUser({
          name: row.parentName,
          email: row.parentEmail,
          password: row.parentPassword || 'parent123',
          role: 'PARENT'
        })

        const studentEntity = await createStudent({
          name: row.studentName,
          email: row.studentEmail,
          grade: row.grade || 'N/A'
        })

        await linkParentToStudent(studentEntity.data?.data?.id, {
          parentUserId: parentUser.data?.user?.id
        })

        created += 1
        pushAudit({
          type: 'bulk_onboarding',
          message: `Bulk created student ${studentUser.data?.user?.name} and linked parent ${parentUser.data?.user?.name}`
        })
      } catch (_error) {
        failed += 1
      }
    }

    setBulkSummary({ created, failed })
  }

  if (loading) {
    return (
      <div className={cardClass}>
        <LoadingShimmer rows={10} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={cardClass}><SectionTitle icon={GraduationCap} title="Total Students" /><p className="text-3xl font-bold">{studentsCount}</p></div>
        <div className={cardClass}><SectionTitle icon={Users} title="Total Teachers" /><p className="text-3xl font-bold">{teachersCount}</p></div>
        <div className={cardClass}><SectionTitle icon={Wallet} title="Revenue" /><p className="text-3xl font-bold">{simulatedRevenue}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={cardClass}>
          <SectionTitle icon={Shield} title="System Health" subtitle="Control Tower observability" />
          <p className="text-sm">Status: <span className="font-semibold">{systemHealth.status}</span></p>
          <p className="text-sm text-slate-600">{systemHealth.message}</p>

          <div className="mt-4">
            <SectionTitle icon={BookOpen} title="Audit Logs" subtitle="Sensitive changes tracking" />
            {auditLogs.length ? (
              <ul className="max-h-64 space-y-2 overflow-auto text-sm">
                {auditLogs.map((log, index) => (
                  <li key={`${log.at}-${index}`} className="rounded-lg border border-slate-200 p-2">
                    <p className="font-medium">{log.type}</p>
                    <p className="text-slate-600">{log.message}</p>
                    <p className="text-xs text-slate-400">{new Date(log.at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No audit entries" description="Sensitive actions appear in this stream." icon={Shield} />
            )}
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={TrendingUp} title="Revenue & Enrollment Analytics" subtitle="Paid vs pending tuition" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tuitionData} dataKey="value" nameKey="label" outerRadius={90}>
                  {tuitionData.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={cardClass}>
          <SectionTitle icon={Users} title="User Management" subtitle="Role governance" />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200"><th className="px-2 py-2">Name</th><th className="px-2 py-2">Role</th><th className="px-2 py-2">Action</th></tr></thead>
              <tbody>
                {users.slice(0, 20).map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{item.name}</td>
                    <td className="px-2 py-2">{item.role}</td>
                    <td className="px-2 py-2"><button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => setRoleModal({ open: true, userId: item.id, role: item.role })}>Edit Role</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={Upload} title="Bulk User Onboarding" subtitle="CSV upload for student-parent provisioning" />
          <p className="mb-2 text-xs text-slate-500">Required columns: studentName,studentEmail,studentPassword,parentName,parentEmail,parentPassword,grade</p>
          <input type="file" accept=".csv" onChange={handleBulkFile} className="text-sm" />
          <p className="mt-2 text-sm">Created: <span className="font-semibold">{bulkSummary.created}</span> | Failed: <span className="font-semibold">{bulkSummary.failed}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={cardClass}>
          <SectionTitle icon={Calendar} title="Academic Year Toggle" subtitle="Single active year policy" />
          {academicYears.map((year) => (
            <div key={year.id} className="mb-2 flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm">
              <span>{year.name}</span>
              <button type="button" onClick={() => toggleAcademicYear(year)} className={`rounded px-2 py-1 ${year.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                {year.isActive ? 'Active' : 'Set Active'}
              </button>
            </div>
          ))}
        </div>

        <div className={cardClass}>
          <SectionTitle icon={Megaphone} title="Global Broadcast" subtitle="Emergency banner pinned to all dashboards" />
          <textarea
            rows={4}
            value={emergencyText}
            onChange={(event) => setEmergencyText(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Emergency alert text..."
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={publishEmergency} className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white">Publish Emergency</button>
            <button type="button" onClick={() => localStorage.removeItem('globalEmergencyBanner')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Clear Local Banner</button>
          </div>
        </div>
      </div>

      {roleModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <h4 className="text-base font-semibold">Edit User Role</h4>
            <select className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={roleModal.role} onChange={(event) => setRoleModal((prev) => ({ ...prev, role: event.target.value }))}>
              <option value="ADMIN">ADMIN</option>
              <option value="TEACHER">TEACHER</option>
              <option value="PARENT">PARENT</option>
              <option value="STUDENT">STUDENT</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setRoleModal({ open: false, userId: null, role: '' })}>Cancel</button>
              <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" onClick={updateRole}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function RoleSpecificView() {
  const { user } = useAuth()

  if (!user?.role) {
    return (
      <div className={cardClass}>
        <LoadingShimmer rows={4} />
      </div>
    )
  }

  if (user.role === 'ADMIN') return <AdminDashboard />
  if (user.role === 'TEACHER') return <TeacherDashboard user={user} />
  if (user.role === 'PARENT') return <ParentDashboard />
  if (user.role === 'STUDENT') return <StudentDashboard user={user} />

  return (
    <EmptyState title="Role not recognized" description="No dashboard mapped for this role." icon={XCircle} />
  )
}
