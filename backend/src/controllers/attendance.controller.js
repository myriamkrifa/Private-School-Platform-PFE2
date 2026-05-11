const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')

const ALLOWED_STATUS = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']

const getTeacherProfileId = async (userId) => {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: Number(userId) },
    select: { id: true }
  })
  return teacher?.id || null
}

const notifyParentsOnAbsence = async (studentId, status) => {
  if (status !== 'ABSENT' && status !== 'LATE') return
  const links = await prisma.parentStudent.findMany({
    where: { studentId: Number(studentId) },
    select: { parentId: true }
  })
  if (links.length === 0) return
  await prisma.notification.createMany({
    data: links.map((link) => ({
      userId: link.parentId,
      type: 'ABSENCE',
      title: status === 'ABSENT' ? 'Absence recorded' : 'Late arrival recorded',
      message: status === 'ABSENT'
        ? 'A new absence has been recorded for your child.'
        : 'Your child arrived late to class.'
    }))
  })
}

exports.markAttendance = async (req, res) => {
  try {
    const { studentId, classId, courseId, date, status, justification, comment } = req.body

    if (!studentId || !date || !status) {
      return res.status(400).json({ message: 'Please provide studentId, date, and status.' })
    }
    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: `status must be one of ${ALLOWED_STATUS.join(', ')}.` })
    }

    const parsedStudentId = Number.parseInt(studentId, 10)
    const parsedClassId = classId ? Number.parseInt(classId, 10) : null
    const parsedCourseId = courseId ? Number.parseInt(courseId, 10) : null
    const attendanceDate = new Date(date)

    if (req.user?.role === 'TEACHER' && parsedClassId && parsedCourseId) {
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

    const record = await prisma.attendance.upsert({
      where: {
        studentId_classId_courseId_date: {
          studentId: parsedStudentId,
          classId: parsedClassId,
          courseId: parsedCourseId,
          date: attendanceDate
        }
      },
      create: {
        studentId: parsedStudentId,
        classId: parsedClassId,
        courseId: parsedCourseId,
        date: attendanceDate,
        status,
        justification: justification || null,
        comment: comment || null,
        takenById: req.user?.id
      },
      update: {
        status,
        justification: justification || null,
        comment: comment || null,
        takenById: req.user?.id
      }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'ATTENDANCE_UPSERT',
      entityType: 'Attendance',
      entityId: record.id,
      after: { studentId: record.studentId, date: record.date, status: record.status }
    })

    await notifyParentsOnAbsence(parsedStudentId, status)

    return res.status(201).json({ success: true, data: record, message: 'Attendance saved.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error marking attendance.', error: error.message })
  }
}

exports.bulkUpsertAttendance = async (req, res) => {
  try {
    // Accept both classic { courseId } and the more semantic { subjectId }.
    const { classId, courseId, subjectId, date, records } = req.body
    const effectiveCourseId = courseId ?? subjectId

    if (!classId || !effectiveCourseId || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'classId, courseId/subjectId, date and records[] are required.' })
    }

    const parsedClassId = Number.parseInt(classId, 10)
    const parsedCourseId = Number.parseInt(effectiveCourseId, 10)
    const attendanceDate = new Date(date)

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

    const students = await prisma.student.findMany({
      where: { classId: parsedClassId },
      select: { id: true }
    })
    const validStudentIds = new Set(students.map((s) => s.id))

    for (const row of records) {
      if (!validStudentIds.has(Number(row.studentId))) {
        return res.status(400).json({ message: 'One or more students are not in the selected class.' })
      }
      if (!ALLOWED_STATUS.includes(row.status)) {
        return res.status(400).json({ message: `Invalid attendance status: ${row.status}` })
      }
    }

    const result = await prisma.$transaction(
      records.map((row) =>
        prisma.attendance.upsert({
          where: {
            studentId_classId_courseId_date: {
              studentId: Number(row.studentId),
              classId: parsedClassId,
              courseId: parsedCourseId,
              date: attendanceDate
            }
          },
          create: {
            studentId: Number(row.studentId),
            classId: parsedClassId,
            courseId: parsedCourseId,
            date: attendanceDate,
            status: row.status,
            justification: row.justification || null,
            comment: row.comment || null,
            takenById: req.user?.id
          },
          update: {
            status: row.status,
            justification: row.justification || null,
            comment: row.comment || null,
            takenById: req.user?.id
          }
        })
      )
    )

    // Notify parents for absences/late records (best-effort, non-blocking semantics)
    for (const row of records) {
      await notifyParentsOnAbsence(row.studentId, row.status)
    }

    return res.json({ success: true, data: result, message: 'Attendance saved.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error upserting attendance.', error: error.message })
  }
}

exports.getStudentAttendance = async (req, res) => {
  try {
    const studentId = Number.parseInt(req.params.studentId, 10)

    // Parents/students may only access their own data; admin/teachers can read.
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

    const records = await prisma.attendance.findMany({
      where: { studentId },
      include: {
        course: { select: { id: true, title: true, code: true } },
        class: { select: { id: true, name: true } }
      },
      orderBy: { date: 'desc' }
    })
    return res.json({ success: true, data: records })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching attendance.', error: error.message })
  }
}

exports.getClassAttendance = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)
    const { date, courseId } = req.query

    const where = { classId }
    if (date) {
      const day = new Date(date)
      day.setHours(0, 0, 0, 0)
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      where.date = { gte: day, lt: next }
    }
    if (courseId) where.courseId = Number.parseInt(courseId, 10)

    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } }
      },
      orderBy: { date: 'desc' }
    })
    return res.json({ success: true, data: records })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching class attendance.', error: error.message })
  }
}

exports.justifyAbsence = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const { justification } = req.body

    const updated = await prisma.attendance.update({
      where: { id },
      data: { justification, status: 'EXCUSED' }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'ATTENDANCE_JUSTIFY',
      entityType: 'Attendance',
      entityId: updated.id,
      after: { justification: updated.justification }
    })

    return res.json({ success: true, data: updated, message: 'Absence justification saved.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error updating absence.', error: error.message })
  }
}
