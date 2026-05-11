const prisma = require('../prisma')

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
      prisma.academicYear.findFirst({ where: { isActive: true } }),
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
