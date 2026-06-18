const prisma = require('../prisma')
const { getTeacherClassIds } = require('../services/teacherClassAccess.service')

const startOfDay = (date = new Date()) => {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

const endOfDay = (date = new Date()) => {
  const day = new Date(date)
  day.setHours(23, 59, 59, 999)
  return day
}

// ─────────────────────────────────────────────
// GET /api/admin/dashboard
// ─────────────────────────────────────────────
exports.getAdminDashboard = async (_req, res) => {
  try {
    const today = new Date()
    const dayStart = startOfDay(today)
    const dayEnd = endOfDay(today)

    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      totalSubjects,
      activeYear,
      todayAbsences,
      todayLate,
      recentAnnouncements,
      recentAuditLogs,
      recentGrades
    ] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.user.count({ where: { role: 'PARENT' } }),
      prisma.class.count(),
      prisma.course.count(),
      prisma.academicYear.findFirst({ where: { isActive: true, isArchived: false } }),
      prisma.attendance.count({
        where: { status: 'ABSENT', date: { gte: dayStart, lte: dayEnd } }
      }),
      prisma.attendance.count({
        where: { status: 'LATE', date: { gte: dayStart, lte: dayEnd } }
      }),
      prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { createdBy: { select: { id: true, name: true, role: true } } }
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { actor: { select: { id: true, name: true, role: true } } }
      }),
      prisma.grade.findMany({
        orderBy: { recordedAt: 'desc' },
        take: 5,
        include: {
          student: { select: { id: true, name: true } },
          course: { select: { id: true, title: true } }
        }
      })
    ])

    return res.json({
      success: true,
      data: {
        stats: {
          totalStudents,
          totalTeachers,
          totalParents,
          totalClasses,
          totalSubjects,
          todayAbsences,
          todayLate
        },
        activeAcademicYear: activeYear,
        recentAnnouncements,
        recentAuditLogs,
        recentGrades
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading admin dashboard.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// GET /api/teacher/dashboard
// ─────────────────────────────────────────────
exports.getTeacherDashboard = async (req, res) => {
  try {
    const userId = req.user.id
    const teacherProfile = await prisma.teacher.findUnique({
      where: { userId },
      select: { id: true, name: true, specialty: true, subject: true }
    })

    if (!teacherProfile) {
      return res.json({
        success: true,
        data: {
          profile: null,
          stats: { classesCount: 0, subjectsCount: 0, todayAttendanceTaken: 0, recentGradesCount: 0 },
          assignedClasses: [],
          assignedSubjects: [],
          recentGrades: [],
          recentAssignments: [],
          recentMessages: []
        }
      })
    }

    const dayStart = startOfDay()
    const dayEnd = endOfDay()

    const [
      assignments,
      linkedClasses,
      recentGrades,
      recentAssignments,
      recentMessages,
      todayAttendanceTaken
    ] = await Promise.all([
      prisma.teachingAssignment.findMany({
        where: { teacherId: teacherProfile.id },
        include: {
          class: { select: { id: true, name: true, room: true, level: true } },
          course: { select: { id: true, title: true, code: true, coefficient: true } }
        }
      }),
      getTeacherClassIds(teacherProfile.id).then((classIds) => (
        classIds.length
          ? prisma.class.findMany({
              where: { id: { in: classIds } },
              select: { id: true, name: true, room: true, level: true }
            })
          : []
      )),
      prisma.grade.findMany({
        where: { teacherId: userId },
        orderBy: { recordedAt: 'desc' },
        take: 5,
        include: {
          student: { select: { id: true, name: true } },
          course: { select: { id: true, title: true } }
        }
      }),
      prisma.assignment.findMany({
        where: { teacherId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          class: { select: { id: true, name: true } },
          course: { select: { id: true, title: true } }
        }
      }),
      prisma.message.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { sender: { select: { id: true, name: true, role: true, email: true } } }
      }),
      prisma.attendance.count({
        where: {
          takenById: userId,
          date: { gte: dayStart, lte: dayEnd }
        }
      })
    ])

    const classMap = new Map()
    const subjectMap = new Map()
    assignments.forEach((row) => {
      if (row.class) classMap.set(row.class.id, row.class)
      if (row.course) subjectMap.set(row.course.id, row.course)
    })
    linkedClasses.forEach((klass) => {
      if (!classMap.has(klass.id)) classMap.set(klass.id, klass)
    })

    return res.json({
      success: true,
      data: {
        profile: teacherProfile,
        stats: {
          classesCount: classMap.size,
          subjectsCount: subjectMap.size,
          todayAttendanceTaken,
          recentGradesCount: recentGrades.length
        },
        assignedClasses: Array.from(classMap.values()),
        assignedSubjects: Array.from(subjectMap.values()),
        recentGrades,
        recentAssignments,
        recentMessages
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading teacher dashboard.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// GET /api/parent/dashboard
// ─────────────────────────────────────────────
exports.getParentDashboard = async (req, res) => {
  try {
    const parentId = req.user.id

    const links = await prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: {
          include: {
            class: { select: { id: true, name: true, room: true, level: true } },
            grades: {
              orderBy: { recordedAt: 'desc' },
              take: 5,
              include: { course: { select: { id: true, title: true } } }
            },
            attendances: {
              orderBy: { date: 'desc' },
              take: 7
            }
          }
        }
      }
    })

    const children = links.map((link) => link.student)
    const childIds = children.map((child) => child.id)

    const [latestGrades, recentAbsences, recentAnnouncements, recentMessages, unreadNotifications] = await Promise.all([
      childIds.length
        ? prisma.grade.findMany({
            where: { studentId: { in: childIds } },
            orderBy: { recordedAt: 'desc' },
            take: 8,
            include: {
              student: { select: { id: true, name: true } },
              course: { select: { id: true, title: true } }
            }
          })
        : [],
      childIds.length
        ? prisma.attendance.findMany({
            where: { studentId: { in: childIds }, status: { in: ['ABSENT', 'LATE'] } },
            orderBy: { date: 'desc' },
            take: 8,
            include: {
              student: { select: { id: true, name: true } },
              course: { select: { id: true, title: true } }
            }
          })
        : [],
      prisma.announcement.findMany({
        where: {
          OR: [
            { targetRole: null, classId: null },
            { targetRole: 'PARENT' }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.message.findMany({
        where: { recipientId: parentId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { sender: { select: { id: true, name: true, role: true, email: true } } }
      }),
      prisma.notification.count({ where: { userId: parentId, isRead: false } })
    ])

    return res.json({
      success: true,
      data: {
        children,
        stats: {
          childrenCount: children.length,
          unreadNotifications,
          recentAbsencesCount: recentAbsences.length,
          latestGradesCount: latestGrades.length
        },
        latestGrades,
        recentAbsences,
        recentAnnouncements,
        recentMessages
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading parent dashboard.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// GET /api/student/dashboard
// ─────────────────────────────────────────────
exports.getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user.id
    const profile = await prisma.student.findUnique({
      where: { userId },
      include: {
        class: {
          select: { id: true, name: true, room: true, level: true }
        }
      }
    })

    if (!profile) {
      return res.json({
        success: true,
        data: {
          profile: null,
          stats: { gradesCount: 0, presentCount: 0, absentCount: 0, lateCount: 0, upcomingAssignmentsCount: 0 },
          subjects: [],
          latestGrades: [],
          recentAttendance: [],
          upcomingAssignments: [],
          announcements: [],
          courseMaterials: []
        }
      })
    }

    const studentId = profile.id
    const classId = profile.classId

    const subjects = classId
      ? await prisma.teachingAssignment.findMany({
          where: { classId },
          include: {
            course: { select: { id: true, title: true, code: true, coefficient: true } },
            teacher: { select: { id: true, name: true, email: true } }
          }
        })
      : []

    const subjectsList = []
    const seenSubjects = new Set()
    subjects.forEach((row) => {
      if (row.course && !seenSubjects.has(row.course.id)) {
        seenSubjects.add(row.course.id)
        subjectsList.push({ ...row.course, teacher: row.teacher })
      }
    })

    const subjectIds = subjectsList.map((s) => s.id)
    const now = new Date()

    const [
      latestGrades,
      recentAttendance,
      upcomingAssignments,
      classAnnouncements,
      generalAnnouncements,
      courseMaterials,
      attendanceCounts
    ] = await Promise.all([
      prisma.grade.findMany({
        where: { studentId },
        orderBy: { recordedAt: 'desc' },
        take: 8,
        include: { course: { select: { id: true, title: true } } }
      }),
      prisma.attendance.findMany({
        where: { studentId },
        orderBy: { date: 'desc' },
        take: 8,
        include: { course: { select: { id: true, title: true } } }
      }),
      prisma.assignment.findMany({
        where: {
          dueDate: { gte: now },
          OR: [
            { classId: classId || -1, targetType: 'FULL_CLASS' },
            { recipients: { some: { studentId } } }
          ]
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
        include: {
          class: { select: { id: true, name: true } },
          course: { select: { id: true, title: true } }
        }
      }),
      classId
        ? prisma.announcement.findMany({
            where: { classId },
            orderBy: { createdAt: 'desc' },
            take: 5
          })
        : [],
      prisma.announcement.findMany({
        where: {
          OR: [
            { targetRole: null, classId: null },
            { targetRole: 'STUDENT' }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      subjectIds.length
        ? prisma.courseMaterial.findMany({
            where: { courseId: { in: subjectIds } },
            orderBy: { createdAt: 'desc' },
            take: 8,
            include: { course: { select: { id: true, title: true } } }
          })
        : [],
      prisma.attendance.groupBy({
        by: ['status'],
        where: { studentId },
        _count: { _all: true }
      })
    ])

    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    attendanceCounts.forEach((row) => {
      counts[row.status] = row._count._all
    })

    const announcements = [
      ...classAnnouncements,
      ...generalAnnouncements.filter((g) => !classAnnouncements.some((c) => c.id === g.id))
    ].slice(0, 6)

    return res.json({
      success: true,
      data: {
        profile,
        stats: {
          gradesCount: latestGrades.length,
          presentCount: counts.PRESENT,
          absentCount: counts.ABSENT,
          lateCount: counts.LATE,
          excusedCount: counts.EXCUSED,
          upcomingAssignmentsCount: upcomingAssignments.length
        },
        subjects: subjectsList,
        latestGrades,
        recentAttendance,
        upcomingAssignments,
        announcements,
        courseMaterials
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading student dashboard.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// GET /api/calendar/events
// ─────────────────────────────────────────────
exports.getCalendarEvents = async (req, res) => {
  try {
    const role = req.user?.role
    const userId = req.user?.id

    let assignmentWhere = {}
    if (role === 'TEACHER') {
      assignmentWhere = { teacherId: userId }
    } else if (role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId },
        select: { id: true, classId: true }
      })
      if (!student) {
        return res.json({ success: true, data: [] })
      }
      assignmentWhere = {
        OR: [
          { targetType: 'FULL_CLASS', classId: student.classId },
          { recipients: { some: { studentId: student.id } } }
        ]
      }
    } else if (role === 'PARENT') {
      const links = await prisma.parentStudent.findMany({
        where: { parentId: userId },
        select: { student: { select: { id: true, classId: true } } }
      })
      const childIds = links.map((link) => link.student.id)
      const classIds = [...new Set(links.map((link) => link.student.classId).filter(Boolean))]
      if (childIds.length === 0) {
        return res.json({ success: true, data: [] })
      }
      assignmentWhere = {
        OR: [
          { targetType: 'FULL_CLASS', classId: { in: classIds } },
          { recipients: { some: { studentId: { in: childIds } } } }
        ]
      }
    }

    const [assignments, academicYears, announcements, customEvents] = await Promise.all([
      prisma.assignment.findMany({
        where: assignmentWhere,
        select: {
          id: true,
          title: true,
          dueDate: true,
          class: { select: { name: true } },
          course: { select: { title: true } }
        },
        orderBy: { dueDate: 'asc' }
      }),
      role === 'ADMIN'
        ? prisma.academicYear.findMany({
            select: { id: true, name: true, startDate: true, endDate: true },
            orderBy: { startDate: 'asc' }
          })
        : Promise.resolve([]),
      prisma.announcement.findMany({
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.calendarEvent.findMany({
        select: { id: true, title: true, description: true, date: true },
        orderBy: { date: 'asc' }
      })
    ])

    const events = []

    for (const assignment of assignments) {
      events.push({
        id: `assignment-${assignment.id}`,
        type: 'assignment',
        date: assignment.dueDate,
        title: assignment.title,
        detail: [assignment.class?.name, assignment.course?.title].filter(Boolean).join(' · ')
      })
    }

    for (const year of academicYears) {
      events.push({
        id: `year-start-${year.id}`,
        type: 'academic_year',
        date: year.startDate,
        title: `${year.name} starts`,
        detail: 'Academic year'
      })
      events.push({
        id: `year-end-${year.id}`,
        type: 'academic_year',
        date: year.endDate,
        title: `${year.name} ends`,
        detail: 'Academic year'
      })
    }

    for (const announcement of announcements) {
      events.push({
        id: `announcement-${announcement.id}`,
        type: 'announcement',
        date: announcement.createdAt,
        title: announcement.title,
        detail: 'Announcement'
      })
    }

    for (const customEvent of customEvents) {
      events.push({
        id: `custom-${customEvent.id}`,
        eventId: customEvent.id,
        type: 'custom',
        date: customEvent.date,
        title: customEvent.title,
        detail: customEvent.description || 'School event',
        canDelete: role === 'ADMIN'
      })
    }

    events.sort((a, b) => new Date(a.date) - new Date(b.date))

    return res.json({ success: true, data: events })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading calendar events.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// POST /api/calendar/events
// ─────────────────────────────────────────────
exports.createCalendarEvent = async (req, res) => {
  try {
    const { title, date, description } = req.body
    if (!title?.trim() || !date) {
      return res.status(400).json({ message: 'Please provide title and date.' })
    }

    let parsedDate
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number)
      parsedDate = new Date(year, month - 1, day, 12, 0, 0, 0)
    } else {
      parsedDate = new Date(date)
    }
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date.' })
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        date: parsedDate,
        createdById: req.user?.id
      }
    })

    return res.status(201).json({
      success: true,
      data: {
        id: `custom-${event.id}`,
        eventId: event.id,
        type: 'custom',
        date: event.date,
        title: event.title,
        detail: event.description || 'School event',
        canDelete: true
      },
      message: 'Calendar event created.'
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error creating calendar event.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/calendar/events/:id
// ─────────────────────────────────────────────
exports.deleteCalendarEvent = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid event id.' })
    }

    const existing = await prisma.calendarEvent.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ message: 'Calendar event not found.' })
    }

    await prisma.calendarEvent.delete({ where: { id } })

    return res.json({ success: true, message: 'Calendar event deleted.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting calendar event.', error: error.message })
  }
}
