const prisma = require('../prisma')

const round2 = (value) => (Number.isFinite(value) ? Number(value.toFixed(2)) : null)

const computeAverage = (grades) => {
  if (!grades.length) return null
  const totalScore = grades.reduce((sum, g) => sum + Number(g.score || 0), 0)
  return round2(totalScore / grades.length)
}

const computeWeightedAverage = (grades) => {
  let num = 0
  let den = 0
  grades.forEach((g) => {
    const coef = Number(g.course?.coefficient || 1)
    num += Number(g.score || 0) * coef
    den += coef
  })
  return den > 0 ? round2(num / den) : null
}

// ─────────────────────────────────────────────
// GET /api/reports/class/:classId
// Class report: per-subject average, attendance summary, teacher list
// ─────────────────────────────────────────────
exports.getClassReport = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)
    if (!Number.isInteger(classId) || classId <= 0) {
      return res.status(400).json({ message: 'Invalid classId.' })
    }

    const klass = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { select: { id: true, name: true, email: true } },
        teachingAssignments: {
          include: {
            course: { select: { id: true, title: true, code: true, coefficient: true } },
            teacher: { select: { id: true, name: true, email: true } }
          }
        },
        academicYear: { select: { id: true, name: true, isActive: true } }
      }
    })

    if (!klass) return res.status(404).json({ message: 'Class not found.' })

    const studentIds = klass.students.map((s) => s.id)

    // Per-subject averages
    const subjectMap = new Map()
    klass.teachingAssignments.forEach((row) => {
      if (row.course && !subjectMap.has(row.course.id)) {
        subjectMap.set(row.course.id, { ...row.course, teachers: [] })
      }
      if (row.course && row.teacher) {
        subjectMap.get(row.course.id).teachers.push(row.teacher)
      }
    })

    const grades = studentIds.length
      ? await prisma.grade.findMany({
          where: { classId, studentId: { in: studentIds } },
          include: { course: { select: { id: true, title: true, coefficient: true } } }
        })
      : []

    const gradesBySubject = {}
    grades.forEach((g) => {
      const id = g.courseId || 'unknown'
      if (!gradesBySubject[id]) gradesBySubject[id] = []
      gradesBySubject[id].push(g)
    })

    const subjectAverages = Array.from(subjectMap.values()).map((subject) => {
      const list = gradesBySubject[subject.id] || []
      return {
        subjectId: subject.id,
        subjectTitle: subject.title,
        subjectCode: subject.code,
        coefficient: subject.coefficient,
        teachers: subject.teachers,
        gradesCount: list.length,
        average: computeAverage(list)
      }
    })

    // Attendance summary
    const attendanceCounts = studentIds.length
      ? await prisma.attendance.groupBy({
          by: ['status'],
          where: { classId },
          _count: { _all: true }
        })
      : []

    const attendanceSummary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    attendanceCounts.forEach((row) => {
      attendanceSummary[row.status] = row._count._all
    })

    // Class overall average
    const overallAverage = computeAverage(grades)
    const weightedAverage = computeWeightedAverage(grades)

    return res.json({
      success: true,
      data: {
        class: {
          id: klass.id,
          name: klass.name,
          room: klass.room,
          level: klass.level,
          capacity: klass.capacity,
          academicYear: klass.academicYear
        },
        studentsCount: klass.students.length,
        students: klass.students,
        subjectAverages,
        attendanceSummary,
        overallAverage,
        weightedAverage,
        gradesCount: grades.length
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error generating class report.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// GET /api/reports/student/:studentId
// Per-student report: grade per subject (avg), attendance summary, parent
// ─────────────────────────────────────────────
exports.getStudentReport = async (req, res) => {
  try {
    const studentId = Number.parseInt(req.params.studentId, 10)
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ message: 'Invalid studentId.' })
    }

    if (req.user?.role === 'PARENT') {
      const link = await prisma.parentStudent.findFirst({
        where: { parentId: req.user.id, studentId }
      })
      if (!link) {
        return res.status(403).json({ message: 'Forbidden. This child is not linked to your account.' })
      }
    }
    if (req.user?.role === 'STUDENT') {
      const own = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { id: true }
      })
      if (!own || own.id !== studentId) {
        return res.status(403).json({ message: 'Forbidden.' })
      }
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: { select: { id: true, name: true, room: true, level: true } },
        parentLinks: {
          include: { parent: { select: { id: true, name: true, email: true, phoneNumber: true } } }
        }
      }
    })

    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const [grades, attendanceCounts] = await Promise.all([
      prisma.grade.findMany({
        where: { studentId },
        include: { course: { select: { id: true, title: true, code: true, coefficient: true } } },
        orderBy: { recordedAt: 'desc' }
      }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: { studentId },
        _count: { _all: true }
      })
    ])

    const bySubject = {}
    grades.forEach((g) => {
      const id = g.courseId || 'unknown'
      if (!bySubject[id]) {
        bySubject[id] = {
          subjectId: g.course?.id ?? null,
          subjectTitle: g.course?.title || g.subject || 'Subject',
          subjectCode: g.course?.code || null,
          coefficient: g.course?.coefficient || 1,
          grades: []
        }
      }
      bySubject[id].grades.push(g)
    })

    const subjectAverages = Object.values(bySubject).map((row) => ({
      subjectId: row.subjectId,
      subjectTitle: row.subjectTitle,
      subjectCode: row.subjectCode,
      coefficient: row.coefficient,
      gradesCount: row.grades.length,
      average: computeAverage(row.grades)
    }))

    const attendanceSummary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    attendanceCounts.forEach((row) => {
      attendanceSummary[row.status] = row._count._all
    })

    return res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          status: student.status,
          enrollmentDate: student.enrollmentDate
        },
        class: student.class,
        parents: student.parentLinks.map((link) => link.parent),
        overallAverage: computeAverage(grades),
        weightedAverage: computeWeightedAverage(grades),
        gradesCount: grades.length,
        subjectAverages,
        attendanceSummary
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error generating student report.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// GET /api/reports/teacher-workload
// ─────────────────────────────────────────────
exports.getTeacherWorkloadReport = async (_req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: {
        teachingAssignments: {
          include: {
            class: { select: { id: true, name: true, level: true } },
            course: { select: { id: true, title: true, code: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    const data = teachers.map((teacher) => {
      const classSet = new Set()
      const subjectSet = new Set()
      teacher.teachingAssignments.forEach((row) => {
        classSet.add(row.classId)
        subjectSet.add(row.courseId)
      })
      return {
        teacherId: teacher.id,
        name: teacher.name,
        email: teacher.email,
        specialty: teacher.specialty || teacher.subject,
        assignmentsCount: teacher.teachingAssignments.length,
        classesCount: classSet.size,
        subjectsCount: subjectSet.size,
        assignments: teacher.teachingAssignments.map((row) => ({
          class: row.class,
          subject: row.course
        }))
      }
    })

    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ message: 'Error generating teacher workload report.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// CSV exports
// ─────────────────────────────────────────────
const csvCell = (value) => {
  if (value === null || value === undefined) return ''
  const str = String(value).replace(/"/g, '""')
  return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
}

exports.exportClassReport = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)
    const klass = await prisma.class.findUnique({ where: { id: classId } })
    if (!klass) return res.status(404).json({ message: 'Class not found.' })

    const grades = await prisma.grade.findMany({
      where: { classId },
      include: {
        student: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } }
      },
      orderBy: { recordedAt: 'desc' }
    })

    const header = ['student', 'subject', 'type', 'title', 'score', 'maxScore', 'recordedAt'].join(',')
    const rows = grades.map((g) =>
      [g.student?.name, g.course?.title || g.subject, g.type, g.title || '', g.score, g.maxScore, g.recordedAt.toISOString()]
        .map(csvCell)
        .join(',')
    )

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="class-${classId}-report.csv"`)
    return res.send([header, ...rows].join('\n'))
  } catch (error) {
    return res.status(500).json({ message: 'Error exporting class report.', error: error.message })
  }
}
