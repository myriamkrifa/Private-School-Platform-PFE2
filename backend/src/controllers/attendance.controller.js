const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')
const {
  getTeacherProfileId,
  teacherHasClassAccess,
  getSubjectsForTeacherClass,
  teacherCanMarkClassSubject
} = require('../services/teacherClassAccess.service')

const ALLOWED_STATUS = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']

const normalizeAttendanceDate = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(`${value.trim()}T00:00:00.000Z`)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid attendance date.')
  }
  return new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate()
  ))
}

const uniqueCourses = (assignments = []) => {
  const byId = new Map()
  assignments.forEach((row) => {
    if (row.course?.id) byId.set(row.course.id, row.course)
  })
  return Array.from(byId.values())
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

const formatAttendanceStatus = (status) => {
  if (!status) return 'Recorded'
  return status.charAt(0) + status.slice(1).toLowerCase()
}

const notifyStudentOnAttendance = async (studentId, status, courseTitle, attendanceDate) => {
  const student = await prisma.student.findUnique({
    where: { id: Number(studentId) },
    select: { userId: true }
  })
  if (!student?.userId) return

  const subjectLabel = courseTitle || 'your class'
  const dateLabel = new Date(attendanceDate).toLocaleDateString('en-GB')
  const statusLabel = formatAttendanceStatus(status)

  await prisma.notification.create({
    data: {
      userId: student.userId,
      type: 'SYSTEM',
      title: 'Attendance recorded',
      message: `You were marked ${statusLabel} for ${subjectLabel} on ${dateLabel}.`
    }
  })
}

const notifyAttendanceRecorded = async (studentId, status, courseTitle, attendanceDate) => {
  await notifyStudentOnAttendance(studentId, status, courseTitle, attendanceDate)
  await notifyParentsOnAbsence(studentId, status)
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
    const attendanceDate = normalizeAttendanceDate(date)

    if (req.user?.role === 'TEACHER' && parsedClassId && parsedCourseId) {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const allowed = await teacherCanMarkClassSubject(
        teacherProfileId,
        parsedClassId,
        parsedCourseId
      )
      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to this class/subject.' })
      }
    }

    const course = parsedCourseId
      ? await prisma.course.findUnique({
          where: { id: parsedCourseId },
          select: { title: true }
        })
      : null

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

    await notifyAttendanceRecorded(
      parsedStudentId,
      status,
      course?.title || null,
      attendanceDate
    )

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
    const attendanceDate = normalizeAttendanceDate(date)

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const allowed = await teacherCanMarkClassSubject(
        teacherProfileId,
        parsedClassId,
        parsedCourseId
      )
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

    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: { title: true }
    })
    const courseTitle = course?.title || null

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

    for (const row of records) {
      await notifyAttendanceRecorded(row.studentId, row.status, courseTitle, attendanceDate)
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
      orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }]
    })
    return res.json({ success: true, data: records })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching attendance.', error: error.message })
  }
}

exports.getMyAttendance = async (req, res) => {
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

    const records = await prisma.attendance.findMany({
      where: { studentId: profile.id },
      include: {
        course: { select: { id: true, title: true, code: true } },
        class: { select: { id: true, name: true } }
      },
      orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }]
    })
    return res.json({ success: true, data: records })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching attendance.', error: error.message })
  }
}

exports.getAttendanceMarkSheet = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)

    let subjects = []
    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      if (!teacherProfileId) {
        return res.status(403).json({ message: 'Teacher profile not found.' })
      }
      const allowed = await teacherHasClassAccess(teacherProfileId, classId)
      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to this class.' })
      }
      subjects = await getSubjectsForTeacherClass(teacherProfileId, classId)
    } else {
      const assignments = await prisma.teachingAssignment.findMany({
        where: { classId },
        include: { course: { select: { id: true, title: true, code: true } } }
      })
      subjects = uniqueCourses(assignments)
    }

    const students = await prisma.student.findMany({
      where: { classId },
      select: { id: true, name: true, email: true, grade: true },
      orderBy: { name: 'asc' }
    })

    return res.json({
      success: true,
      data: {
        students,
        subjects
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading attendance sheet.', error: error.message })
  }
}

exports.getClassAttendance = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)
    const { date, courseId } = req.query

    const where = { classId }
    if (date) {
      const day = normalizeAttendanceDate(date)
      const next = new Date(day)
      next.setUTCDate(next.getUTCDate() + 1)
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

exports.updateAttendance = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const { status } = req.body

    if (!status || !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: `status must be one of ${ALLOWED_STATUS.join(', ')}.` })
    }

    const existing = await prisma.attendance.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        classId: true,
        courseId: true,
        status: true,
        date: true,
        course: { select: { title: true } }
      }
    })
    if (!existing) {
      return res.status(404).json({ message: 'Attendance record not found.' })
    }

    if (req.user?.role === 'TEACHER' && existing.classId && existing.courseId) {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const allowed = await teacherCanMarkClassSubject(
        teacherProfileId,
        existing.classId,
        existing.courseId
      )
      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to this class/subject.' })
      }
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: { status, takenById: req.user?.id }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'ATTENDANCE_UPDATE',
      entityType: 'Attendance',
      entityId: updated.id,
      before: { status: existing.status },
      after: { status: updated.status }
    })

    await notifyAttendanceRecorded(
      existing.studentId,
      status,
      existing.course?.title || null,
      existing.date
    )

    return res.json({ success: true, data: updated, message: 'Attendance updated.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error updating attendance.', error: error.message })
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
