const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')
const { parseStudentIdInput } = require('../utils/studentId.util')

const GRADE_TYPES = ['TEST', 'EXAM', 'HOMEWORK', 'ORAL', 'PROJECT']

const getTeacherProfileId = async (userId) => {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: Number(userId) },
    select: { id: true }
  })
  return teacher?.id || null
}

const isValidScore = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 && n <= 20
}

const parseStudentIdParam = (value) => parseStudentIdInput(value)

const notifyParentsOnGrade = async (studentId, subject) => {
  const links = await prisma.parentStudent.findMany({
    where: { studentId: Number(studentId) },
    select: { parentId: true }
  })
  if (links.length === 0) return
  await prisma.notification.createMany({
    data: links.map((link) => ({
      userId: link.parentId,
      type: 'GRADE',
      title: 'New grade',
      message: `New grade posted for ${subject}.`
    }))
  })
}

const notifyStudentOnGrade = async (studentId, subject, score, title, gradeType) => {
  const student = await prisma.student.findUnique({
    where: { id: Number(studentId) },
    select: { userId: true }
  })
  if (!student?.userId) return

  const evaluation = title ? `"${title}"` : (gradeType || 'evaluation').toLowerCase()
  await prisma.notification.create({
    data: {
      userId: student.userId,
      type: 'GRADE',
      title: 'New grade posted',
      message: `You received ${score}/20 in ${subject} for ${evaluation}.`
    }
  })
}

const notifyGradeRecorded = async (studentId, subject, score, title, gradeType) => {
  await notifyStudentOnGrade(studentId, subject, score, title, gradeType)
  await notifyParentsOnGrade(studentId, subject)
}

exports.createGrade = async (req, res) => {
  try {
    const { studentId, classId, courseId, subject, score, maxScore, comments, type, title } = req.body

    if (!studentId || !classId || !courseId || score === undefined) {
      return res.status(400).json({ message: 'Please provide studentId, classId, courseId, and score.' })
    }
    if (!isValidScore(score)) {
      return res.status(400).json({ message: 'score must be between 0 and 20.' })
    }

    const parsedStudentId = Number.parseInt(studentId, 10)
    const parsedClassId = Number.parseInt(classId, 10)
    const parsedCourseId = Number.parseInt(courseId, 10)
    const finalType = type && GRADE_TYPES.includes(type) ? type : 'TEST'

    const student = await prisma.student.findUnique({ where: { id: parsedStudentId } })
    if (!student || student.classId !== parsedClassId) {
      return res.status(400).json({ message: 'Selected student does not belong to this class.' })
    }

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      if (!teacherProfileId) {
        return res.status(403).json({ message: 'Teacher profile not found.' })
      }
      const assignment = await prisma.teachingAssignment.findUnique({
        where: {
          teacherId_classId_courseId: {
            teacherId: teacherProfileId,
            classId: parsedClassId,
            courseId: parsedCourseId
          }
        }
      })
      if (!assignment) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to this class/subject.' })
      }
    }

    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: { title: true }
    })
    const finalSubject = subject || course?.title || 'Subject'

    const created = await prisma.grade.create({
      data: {
        studentId: parsedStudentId,
        classId: parsedClassId,
        courseId: parsedCourseId,
        teacherId: req.user?.id,
        subject: finalSubject,
        score: Number(score),
        maxScore: maxScore !== undefined ? Number(maxScore) : 20,
        type: finalType,
        title: title || null,
        comments: comments || null
      }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'GRADE_CREATE',
      entityType: 'Grade',
      entityId: created.id,
      after: created
    })
    await notifyGradeRecorded(parsedStudentId, finalSubject, Number(score), title, finalType)

    return res.status(201).json({ success: true, data: created, message: 'Grade recorded.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error creating grade.', error: error.message })
  }
}

exports.bulkUpsertGrades = async (req, res) => {
  try {
    const { classId, courseId, subjectId, grades, type, title, date } = req.body
    const effectiveCourseId = courseId ?? subjectId

    if (!classId || !effectiveCourseId || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ message: 'classId, courseId/subjectId and grades[] are required.' })
    }

    const parsedClassId = Number.parseInt(classId, 10)
    const parsedCourseId = Number.parseInt(effectiveCourseId, 10)
    const finalType = type && GRADE_TYPES.includes(type) ? type : 'TEST'
    const recordedAt = date ? new Date(date) : undefined

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const allowed = await prisma.teachingAssignment.findUnique({
        where: {
          teacherId_classId_courseId: {
            teacherId: teacherProfileId,
            classId: parsedClassId,
            courseId: parsedCourseId
          }
        }
      })
      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to this class/subject.' })
      }
    }

    const classStudents = await prisma.student.findMany({
      where: { classId: parsedClassId },
      select: { id: true }
    })
    const classStudentIds = new Set(classStudents.map((s) => s.id))
    for (const entry of grades) {
      if (!classStudentIds.has(Number(entry.studentId))) {
        return res.status(400).json({ message: 'One or more students are not in selected class.' })
      }
      if (!isValidScore(entry.score)) {
        return res.status(400).json({ message: 'All grade values must be between 0 and 20.' })
      }
    }

    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: { title: true }
    })
    const subject = course?.title || 'Subject'

    const result = await prisma.$transaction(
      grades.map((entry) =>
        prisma.grade.create({
          data: {
            studentId: Number(entry.studentId),
            classId: parsedClassId,
            courseId: parsedCourseId,
            teacherId: req.user?.id,
            subject,
            score: Number(entry.score),
            maxScore: 20,
            type: finalType,
            title: title || null,
            comments: entry.comments || null,
            ...(recordedAt ? { recordedAt } : {})
          }
        })
      )
    )

    // Notifications + audit (one entry per affected student)
    for (const entry of grades) {
      await notifyGradeRecorded(
        entry.studentId,
        subject,
        Number(entry.score),
        title,
        finalType
      )
    }
    await createAuditLog({
      actorId: req.user?.id,
      action: 'GRADE_BULK_CREATE',
      entityType: 'Grade',
      metadata: { classId: parsedClassId, courseId: parsedCourseId, count: grades.length, type: finalType }
    })

    return res.json({ success: true, data: result, message: 'Grades saved.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error upserting grades.', error: error.message })
  }
}

exports.getGradesByClassSubject = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)
    const courseId = Number.parseInt(req.params.subjectId || req.params.courseId, 10)

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const allowed = await prisma.teachingAssignment.findUnique({
        where: {
          teacherId_classId_courseId: {
            teacherId: teacherProfileId,
            classId,
            courseId
          }
        }
      })
      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden.' })
      }
    }

    const grades = await prisma.grade.findMany({
      where: { classId, courseId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: [{ recordedAt: 'desc' }, { updatedAt: 'desc' }]
    })
    return res.json({ success: true, data: grades })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching grades.', error: error.message })
  }
}

exports.getClassAverage = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)
    if (!Number.isInteger(classId) || classId <= 0) {
      return res.status(400).json({ message: 'Invalid classId.' })
    }

    const klass = await prisma.class.findUnique({
      where: { id: classId },
      include: { students: { select: { id: true, name: true } } }
    })
    if (!klass) {
      return res.status(404).json({ message: 'Class not found.' })
    }

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const teaching = await prisma.teachingAssignment.findFirst({
        where: { teacherId: teacherProfileId, classId }
      })
      if (!teaching) {
        return res.status(403).json({ message: 'Forbidden. You can only view averages for your own classes.' })
      }
    }
    if (req.user?.role === 'PARENT') {
      const links = await prisma.parentStudent.findMany({
        where: { parentId: req.user.id },
        select: { student: { select: { classId: true } } }
      })
      const hasChildInClass = links.some((link) => link.student?.classId === classId)
      if (!hasChildInClass) {
        return res.status(403).json({ message: 'Forbidden. Class is not linked to your children.' })
      }
    }

    const studentIds = klass.students.map((s) => s.id)
    if (!studentIds.length) {
      return res.json({
        success: true,
        data: { classId, className: klass.name, studentsCount: 0, gradesCount: 0, average: null, median: null, mode: null }
      })
    }

    const grades = await prisma.grade.findMany({
      where: { studentId: { in: studentIds } },
      select: { score: true }
    })
    const scores = grades.map((g) => Number(g.score)).filter((v) => Number.isFinite(v))
    if (!scores.length) {
      return res.json({
        success: true,
        data: { classId, className: klass.name, studentsCount: studentIds.length, gradesCount: 0, average: null, median: null, mode: null }
      })
    }

    const sorted = scores.slice().sort((a, b) => a - b)
    const average = sorted.reduce((sum, v) => sum + v, 0) / sorted.length
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]

    const frequency = {}
    sorted.forEach((value) => {
      frequency[value] = (frequency[value] || 0) + 1
    })
    let mode = sorted[0]
    let maxFrequency = 0
    Object.entries(frequency).forEach(([value, count]) => {
      if (count > maxFrequency) {
        maxFrequency = count
        mode = Number(value)
      }
    })

    return res.json({
      success: true,
      data: {
        classId,
        className: klass.name,
        studentsCount: studentIds.length,
        gradesCount: sorted.length,
        average: Number(average.toFixed(2)),
        median: Number(median.toFixed(2)),
        mode
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error calculating class average.', error: error.message })
  }
}

exports.getStudentGrades = async (req, res) => {
  try {
    const studentId = parseStudentIdParam(req.params.studentId)
    if (!studentId) {
      return res.status(400).json({ message: 'Please provide a valid student ID.' })
    }

    if (req.user?.role === 'STUDENT') {
      const profile = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { id: true }
      })
      if (!profile || profile.id !== studentId) {
        return res.status(403).json({ message: 'Forbidden.' })
      }
    }
    if (req.user?.role === 'PARENT') {
      const link = await prisma.parentStudent.findFirst({
        where: { parentId: req.user.id, studentId }
      })
      if (!link) {
        return res.status(403).json({ message: 'Forbidden. This child is not linked to your account.' })
      }
    }

    const grades = await prisma.grade.findMany({
      where: { studentId },
      include: { course: { select: { id: true, title: true, code: true, coefficient: true } } },
      orderBy: [{ recordedAt: 'desc' }, { updatedAt: 'desc' }]
    })
    return res.json({ success: true, data: grades })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching grades.', error: error.message })
  }
}

exports.getStudentAverage = async (req, res) => {
  try {
    const studentId = parseStudentIdParam(req.params.studentId)
    if (!studentId) {
      return res.status(400).json({ message: 'Please provide a valid student ID.' })
    }

    if (req.user?.role === 'STUDENT') {
      const profile = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { id: true }
      })
      if (!profile || profile.id !== studentId) {
        return res.status(403).json({ message: 'Forbidden.' })
      }
    }
    if (req.user?.role === 'PARENT') {
      const link = await prisma.parentStudent.findFirst({
        where: { parentId: req.user.id, studentId }
      })
      if (!link) {
        return res.status(403).json({ message: 'Forbidden. This child is not linked to your account.' })
      }
    }

    const grades = await prisma.grade.findMany({
      where: { studentId },
      include: { course: { select: { coefficient: true } } }
    })
    if (grades.length === 0) {
      return res.json({ success: true, average: null, percentage: null, count: 0, weightedAverage: null })
    }

    const totalScore = grades.reduce((sum, g) => sum + Number(g.score), 0)
    const totalMax = grades.reduce((sum, g) => sum + Number(g.maxScore || 20), 0)
    const average = totalScore / grades.length
    const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : null

    let weightedNum = 0
    let weightedDen = 0
    grades.forEach((g) => {
      const coef = Number(g.course?.coefficient || 1)
      weightedNum += Number(g.score) * coef
      weightedDen += coef
    })
    const weightedAverage = weightedDen > 0 ? Number((weightedNum / weightedDen).toFixed(2)) : null

    return res.json({
      success: true,
      average: Number(average.toFixed(2)),
      percentage: percentage !== null ? Number(percentage.toFixed(2)) : null,
      weightedAverage,
      count: grades.length
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error calculating average.', error: error.message })
  }
}

exports.getMyGrades = async (req, res) => {
  try {
    if (req.user?.role !== 'STUDENT') {
      return res.status(403).json({ message: 'Forbidden.' })
    }

    const profile = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true }
    })
    if (!profile) {
      return res.json({ success: true, data: [] })
    }

    const grades = await prisma.grade.findMany({
      where: { studentId: profile.id },
      include: { course: { select: { id: true, title: true, code: true, coefficient: true } } },
      orderBy: [{ recordedAt: 'desc' }, { updatedAt: 'desc' }]
    })
    return res.json({ success: true, data: grades })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching grades.', error: error.message })
  }
}

exports.getMyAverage = async (req, res) => {
  try {
    if (req.user?.role !== 'STUDENT') {
      return res.status(403).json({ message: 'Forbidden.' })
    }

    const profile = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true }
    })
    if (!profile) {
      return res.json({
        success: true,
        average: null,
        percentage: null,
        count: 0,
        weightedAverage: null
      })
    }

    req.params.studentId = String(profile.id)
    return exports.getStudentAverage(req, res)
  } catch (error) {
    return res.status(500).json({ message: 'Error calculating average.', error: error.message })
  }
}

exports.exportStudentGrades = async (req, res) => {
  try {
    const studentId = parseStudentIdParam(req.params.studentId)
    if (!studentId) {
      return res.status(400).json({ message: 'Please provide a valid student ID.' })
    }

    const grades = await prisma.grade.findMany({
      where: { studentId },
      orderBy: [{ recordedAt: 'desc' }, { updatedAt: 'desc' }]
    })

    const header = 'subject,type,title,score,maxScore,recordedAt,comments\n'
    const rows = grades
      .map((g) => `${g.subject},${g.type},${(g.title || '').replace(/,/g, ' ')},${g.score},${g.maxScore},${g.recordedAt.toISOString()},"${(g.comments || '').replace(/"/g, '""')}"`)
      .join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="student-${studentId}-grades.csv"`)
    return res.send(header + rows)
  } catch (error) {
    return res.status(500).json({ message: 'Error exporting grades.', error: error.message })
  }
}
