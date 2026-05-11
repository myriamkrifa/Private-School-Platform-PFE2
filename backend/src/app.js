require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const authRoutes = require('./routes/auth.routes')
const studentRoutes = require('./routes/student.routes')
const teacherRoutes = require('./routes/teacher.routes')
const classRoutes = require('./routes/class.routes')
const userRoutes = require('./routes/user.routes')
const academicYearRoutes = require('./routes/academicYear.routes')
const gradeRoutes = require('./routes/grade.routes')
const attendanceRoutes = require('./routes/attendance.routes')
const courseRoutes = require('./routes/course.routes')
const assignmentRoutes = require('./routes/assignment.routes')
const announcementRoutes = require('./routes/announcement.routes')
const messageRoutes = require('./routes/message.routes')
const notificationRoutes = require('./routes/notification.routes')
const auditRoutes = require('./routes/audit.routes')
const teachingAssignmentRoutes = require('./routes/teachingAssignment.routes')
const teacherWorkRoutes = require('./routes/teacherWork.routes')
const subjectRoutes = require('./routes/subject.routes')
const reportRoutes = require('./routes/report.routes')
const dashboardRoutes = require('./routes/dashboard.routes')

const app  = express()
const PORT = process.env.PORT || 5000

// ── Middlewares ──────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow local frontend hosts on any port for development
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))
app.use(express.json())

// ── Routes ───────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/teachers', teacherRoutes)
app.use('/api/classes', classRoutes)
app.use('/api/users', userRoutes)
app.use('/api/academic-years', academicYearRoutes)
app.use('/api/grades', gradeRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/assignments', assignmentRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/teaching-assignments', teachingAssignmentRoutes)
app.use('/api/subjects', subjectRoutes)
app.use('/api/reports', reportRoutes)
// Role-specific dashboards (mounted at /api so they expose
// /api/admin/dashboard, /api/teacher/dashboard, /api/parent/dashboard,
// /api/student/dashboard).
app.use('/api', dashboardRoutes)
// Teacher workspace endpoints (must be mounted after dashboardRoutes so
// /api/teacher/dashboard hits the dashboard router first).
app.use('/api/teacher', teacherWorkRoutes)

// ── Health check ─────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduManage API is running 🚀' })
})

// ── 404 handler ──────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' })
})

// ── Start server ─────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`)
  console.log(`📡 API: http://localhost:${PORT}/api/auth\n`)
})
