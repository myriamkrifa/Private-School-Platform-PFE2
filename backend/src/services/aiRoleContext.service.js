const prisma = require('../prisma')
const { buildSchoolDataContext, startOfMonth, endOfMonth } = require('./aiContext.service')

async function getTeacherScope(userId) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true, name: true, email: true, subject: true, specialty: true, status: true }
  })
  if (!teacher) {
    return { teacher: null, classIds: [], studentIds: [], courseIds: [], assignments: [] }
  }

  const assignments = await prisma.teachingAssignment.findMany({
    where: { teacherId: teacher.id },
    include: {
      class: { select: { id: true, name: true, room: true, level: true } },
      course: { select: { id: true, title: true, code: true } }
    }
  })

  const classIds = [...new Set(assignments.map((a) => a.classId).filter(Boolean))]
  const courseIds = [...new Set(assignments.map((a) => a.courseId).filter(Boolean))]

  const students =
    classIds.length > 0
      ? await prisma.student.findMany({
          where: { classId: { in: classIds } },
          select: {
            id: true,
            name: true,
            email: true,
            grade: true,
            status: true,
            classId: true,
            class: { select: { id: true, name: true } }
          },
          orderBy: { name: 'asc' }
        })
      : []

  return {
    teacher,
    classIds,
    studentIds: students.map((s) => s.id),
    courseIds,
    assignments,
    students
  }
}

async function buildTeacherContext(userId) {
  const monthStart = startOfMonth()
  const monthEnd = endOfMonth()
  const scope = await getTeacherScope(userId)

  const [monthAttendance, recentGrades, recentAssignments] = await Promise.all([
    scope.studentIds.length
      ? prisma.attendance.groupBy({
          by: ['status'],
          where: {
            studentId: { in: scope.studentIds },
            date: { gte: monthStart, lte: monthEnd }
          },
          _count: { status: true }
        })
      : [],
    scope.studentIds.length
      ? prisma.grade.findMany({
          where: { studentId: { in: scope.studentIds } },
          orderBy: { recordedAt: 'desc' },
          take: 30,
          include: {
            student: { select: { id: true, name: true } },
            course: { select: { id: true, title: true } },
            class: { select: { id: true, name: true } }
          }
        })
      : [],
    prisma.assignment.findMany({
      where: { teacherId: userId },
      orderBy: { dueDate: 'desc' },
      take: 15,
      include: {
        class: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } }
      }
    })
  ])

  const attendanceStats = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
  monthAttendance.forEach((row) => {
    attendanceStats[row.status] = row._count.status
  })

  const classesMap = new Map()
  scope.assignments.forEach((a) => {
    if (a.class) classesMap.set(a.class.id, { ...a.class, courses: [] })
    if (a.class && a.course) {
      const entry = classesMap.get(a.class.id)
      if (entry && !entry.courses.find((c) => c.id === a.course.id)) {
        entry.courses.push(a.course)
      }
    }
  })

  return {
    role: 'TEACHER',
    scope: 'assigned_classes_only',
    profile: scope.teacher,
    assignedClasses: Array.from(classesMap.values()),
    students: scope.students,
    studentCount: scope.students.length,
    attendanceThisMonth: { ...attendanceStats, totalRecords: Object.values(attendanceStats).reduce((a, b) => a + b, 0) },
    recentGrades,
    assignments: recentAssignments
  }
}

async function buildParentContext(userId) {
  const links = await prisma.parentStudent.findMany({
    where: { parentId: userId },
    include: {
      student: {
        include: {
          class: { select: { id: true, name: true, room: true, level: true } },
          grades: {
            orderBy: { recordedAt: 'desc' },
            take: 15,
            include: { course: { select: { id: true, title: true } } }
          },
          attendances: {
            orderBy: { date: 'desc' },
            take: 20,
            include: { course: { select: { id: true, title: true } } }
          }
        }
      }
    }
  })

  const children = links.map((l) => l.student)
  const childIds = children.map((c) => c.id)
  const now = new Date()

  const upcomingAssignments =
    childIds.length > 0
      ? await prisma.assignment.findMany({
          where: {
            dueDate: { gte: now },
            OR: [
              { classId: { in: children.map((c) => c.classId).filter(Boolean) }, targetType: 'FULL_CLASS' },
              { recipients: { some: { studentId: { in: childIds } } } }
            ]
          },
          orderBy: { dueDate: 'asc' },
          take: 12,
          include: {
            class: { select: { name: true } },
            course: { select: { title: true } }
          }
        })
      : []

  const monthStart = startOfMonth()
  const monthEnd = endOfMonth()
  const monthAttendance =
    childIds.length > 0
      ? await prisma.attendance.findMany({
          where: { studentId: { in: childIds }, date: { gte: monthStart, lte: monthEnd } },
          include: {
            student: { select: { name: true } },
            course: { select: { title: true } }
          }
        })
      : []

  return {
    role: 'PARENT',
    scope: 'linked_children_only',
    children: children.map((child) => ({
      id: child.id,
      name: child.name,
      grade: child.grade,
      className: child.class?.name || 'Unassigned',
      recentGrades: child.grades.map((g) => ({
        subject: g.subject,
        course: g.course?.title,
        score: g.score,
        maxScore: g.maxScore,
        recordedAt: g.recordedAt
      })),
      recentAttendance: child.attendances.map((a) => ({
        date: a.date,
        status: a.status,
        course: a.course?.title
      }))
    })),
    upcomingAssignments: upcomingAssignments.map((a) => ({
      title: a.title,
      dueDate: a.dueDate,
      className: a.class?.name,
      course: a.course?.title
    })),
    attendanceThisMonthCount: monthAttendance.length
  }
}

async function buildStudentContext(userId) {
  const profile = await prisma.student.findUnique({
    where: { userId },
    include: {
      class: { select: { id: true, name: true, room: true, level: true } }
    }
  })

  if (!profile) {
    return { role: 'STUDENT', scope: 'own_data_only', profile: null }
  }

  const classId = profile.classId
  const now = new Date()
  const monthStart = startOfMonth()
  const monthEnd = endOfMonth()

  const teachingRows = classId
    ? await prisma.teachingAssignment.findMany({
        where: { classId },
        include: {
          course: { select: { id: true, title: true, code: true } },
          teacher: { select: { id: true, name: true } }
        }
      })
    : []

  const subjects = []
  const seen = new Set()
  teachingRows.forEach((row) => {
    if (row.course && !seen.has(row.course.id)) {
      seen.add(row.course.id)
      subjects.push({ ...row.course, teacherName: row.teacher?.name })
    }
  })

  const [grades, attendances, upcomingAssignments, submissions] = await Promise.all([
    prisma.grade.findMany({
      where: { studentId: profile.id },
      orderBy: { recordedAt: 'desc' },
      take: 20,
      include: { course: { select: { title: true } } }
    }),
    prisma.attendance.findMany({
      where: { studentId: profile.id, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: 'desc' },
      include: { course: { select: { title: true } } }
    }),
    prisma.assignment.findMany({
      where: {
        dueDate: { gte: now },
        OR: [
          { classId: classId || -1, targetType: 'FULL_CLASS' },
          { recipients: { some: { studentId: profile.id } } }
        ]
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
      include: { course: { select: { title: true } }, class: { select: { name: true } } }
    }),
    prisma.submission.findMany({
      where: { studentId: profile.id },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      include: { assignment: { select: { title: true, dueDate: true } } }
    })
  ])

  return {
    role: 'STUDENT',
    scope: 'own_data_only',
    profile: {
      id: profile.id,
      name: profile.name,
      grade: profile.grade,
      className: profile.class?.name,
      room: profile.class?.room,
      level: profile.class?.level
    },
    subjects,
    grades: grades.map((g) => ({
      subject: g.subject,
      course: g.course?.title,
      score: g.score,
      maxScore: g.maxScore,
      type: g.type,
      recordedAt: g.recordedAt
    })),
    attendanceThisMonth: attendances.map((a) => ({
      date: a.date,
      status: a.status,
      course: a.course?.title
    })),
    upcomingAssignments: upcomingAssignments.map((a) => ({
      title: a.title,
      description: a.description,
      dueDate: a.dueDate,
      course: a.course?.title,
      className: a.class?.name
    })),
    recentSubmissions: submissions.map((s) => ({
      assignment: s.assignment?.title,
      dueDate: s.assignment?.dueDate,
      grade: s.grade,
      submittedAt: s.submittedAt
    }))
  }
}

async function buildContextForUser(user) {
  const role = user.role || 'STUDENT'
  switch (role) {
    case 'ADMIN':
      return { ...(await buildSchoolDataContext()), role: 'ADMIN', scope: 'full_school_access' }
    case 'TEACHER':
      return buildTeacherContext(user.id)
    case 'PARENT':
      return buildParentContext(user.id)
    case 'STUDENT':
      return buildStudentContext(user.id)
    default:
      return buildStudentContext(user.id)
  }
}

async function buildReportDataForRole(role, reportType, userId) {
  const context = await buildContextForUser({ id: userId, role })
  return { type: reportType, context, role }
}

module.exports = {
  buildContextForUser,
  buildReportDataForRole,
  getTeacherScope
}
