const prisma = require('../prisma')

const startOfMonth = (date = new Date()) => {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfMonth = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return d
}

/**
 * Builds a structured snapshot of school data for the AI system prompt.
 * All queries are read-only.
 */
async function buildSchoolDataContext() {
  const monthStart = startOfMonth()
  const monthEnd = endOfMonth()

  const [
    totalStudents,
    totalTeachers,
    totalParents,
    totalClasses,
    totalUsers,
    activeYear,
    students,
    teachers,
    classes,
    academicYears,
    usersByRole,
    monthAttendance,
    unpaidFees,
    enrollmentByStatus
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.user.count({ where: { role: 'PARENT' } }),
    prisma.class.count(),
    prisma.user.count(),
    prisma.academicYear.findFirst({
      where: { isActive: true, isArchived: false },
      select: { id: true, name: true, startDate: true, endDate: true }
    }),
    prisma.student.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        grade: true,
        class: { select: { id: true, name: true } }
      },
      take: 200,
      orderBy: { name: 'asc' }
    }),
    prisma.teacher.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        specialty: true,
        status: true,
        _count: { select: { classes: true, teachingAssignments: true } }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.class.findMany({
      select: {
        id: true,
        name: true,
        room: true,
        level: true,
        academicYear: { select: { name: true } },
        _count: { select: { students: true, teachers: true, courses: true } }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.academicYear.findMany({
      where: { isArchived: false },
      select: { id: true, name: true, isActive: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' }
    }),
    prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    }),
    prisma.attendance.groupBy({
      by: ['status'],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _count: { status: true }
    }),
    prisma.studentFee.findMany({
      where: { status: { in: ['UNPAID', 'PARTIAL'] } },
      include: {
        student: { select: { id: true, name: true, email: true, class: { select: { name: true } } } }
      },
      orderBy: { dueDate: 'asc' },
      take: 100
    }),
    prisma.student.groupBy({
      by: ['status'],
      _count: { status: true }
    })
  ])

  const attendanceStats = monthAttendance.reduce(
    (acc, row) => {
      acc[row.status] = row._count.status
      return acc
    },
    { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
  )

  const studentsPerClass = classes.map((c) => ({
    className: c.name,
    room: c.room,
    level: c.level,
    academicYear: c.academicYear?.name || 'Unassigned',
    studentCount: c._count.students,
    teacherCount: c._count.teachers,
    courseCount: c._count.courses
  }))

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      totalUsers,
      activeAcademicYear: activeYear
        ? { name: activeYear.name, startDate: activeYear.startDate, endDate: activeYear.endDate }
        : null,
      unpaidFeesCount: unpaidFees.length
    },
    usersByRole: usersByRole.map((r) => ({ role: r.role, count: r._count.role })),
    academicYears: academicYears.map((y) => ({
      name: y.name,
      isActive: y.isActive,
      startDate: y.startDate,
      endDate: y.endDate
    })),
    studentsPerClass,
    enrollmentByStatus: enrollmentByStatus.map((e) => ({
      status: e.status,
      count: e._count.status
    })),
    attendanceThisMonth: {
      period: { from: monthStart.toISOString(), to: monthEnd.toISOString() },
      ...attendanceStats,
      totalRecords: Object.values(attendanceStats).reduce((a, b) => a + b, 0)
    },
    teachers: teachers.map((t) => ({
      name: t.name,
      email: t.email,
      subject: t.subject || t.specialty,
      status: t.status,
      classesCount: t._count.classes,
      assignmentsCount: t._count.teachingAssignments
    })),
    studentsSample: students.slice(0, 50).map((s) => ({
      name: s.name,
      email: s.email,
      status: s.status,
      grade: s.grade,
      className: s.class?.name || 'Unassigned'
    })),
    unpaidFees: unpaidFees.map((f) => ({
      studentName: f.student.name,
      className: f.student.class?.name || 'N/A',
      label: f.label,
      amount: f.amount,
      status: f.status,
      dueDate: f.dueDate
    })),
    note:
      students.length > 50
        ? `Student list truncated to 50 of ${totalStudents} total. Use counts for totals.`
        : null
  }
}

async function buildReportData(reportType) {
  const context = await buildSchoolDataContext()
  const monthStart = startOfMonth()
  const monthEnd = endOfMonth()

  switch (reportType) {
    case 'ATTENDANCE_MONTHLY': {
      const records = await prisma.attendance.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
        include: {
          student: { select: { name: true } },
          class: { select: { name: true } },
          course: { select: { title: true } }
        },
        orderBy: { date: 'desc' },
        take: 500
      })
      return { type: reportType, context, records: records.length, attendanceThisMonth: context.attendanceThisMonth }
    }
    case 'STUDENT_ENROLLMENT':
      return {
        type: reportType,
        context,
        enrollmentByStatus: context.enrollmentByStatus,
        studentsPerClass: context.studentsPerClass
      }
    case 'TEACHER_WORKLOAD':
      return { type: reportType, context, teachers: context.teachers }
    case 'UNPAID_FEES':
      return { type: reportType, context, unpaidFees: context.unpaidFees }
    default:
      return { type: reportType, context }
  }
}

module.exports = { buildSchoolDataContext, buildReportData, startOfMonth, endOfMonth }
