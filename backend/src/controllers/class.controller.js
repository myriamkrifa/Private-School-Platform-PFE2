const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')
const {
  normalizeEducationLevel,
  isValidGradeForLevel
} = require('../services/classGrade.service')
const {
  getTeacherProfileId,
  getTeacherClassIds
} = require('../services/teacherClassAccess.service')
const {
  prepareAssignmentsWithAutoRooms,
  createSchedulingPlan,
  formatClassTimetableGridHtml
} = require('../services/aiTimetable.service')

const buildClassData = (body) => {
  const { name, room, roomId, level, educationLevel, grade, academicYearId, capacity, description } = body
  const data = {}
  if (name !== undefined) data.name = String(name).trim()
  if (room !== undefined) data.room = String(room).trim()

  if (roomId !== undefined) {
    if (roomId === null || roomId === '') {
      data.roomId = null
    } else {
      const parsedRoomId = Number.parseInt(roomId, 10)
      if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
        throw new Error('Invalid room id.')
      }
      data.roomId = parsedRoomId
    }
  }

  const resolvedLevel = normalizeEducationLevel(educationLevel) || normalizeEducationLevel(level)
  if (resolvedLevel) data.level = resolvedLevel

  if (grade !== undefined) {
    const trimmedGrade = String(grade).trim()
    if (trimmedGrade) {
      if (resolvedLevel && !isValidGradeForLevel(resolvedLevel, trimmedGrade)) {
        throw new Error(`Invalid grade "${trimmedGrade}" for education level ${resolvedLevel}.`)
      }
      data.grade = trimmedGrade
    } else {
      data.grade = null
    }
  }
  if (capacity !== undefined && capacity !== null && capacity !== '') {
    const cap = Number.parseInt(capacity, 10)
    if (!Number.isInteger(cap) || cap < 0) {
      throw new Error('capacity must be a positive integer.')
    }
    data.capacity = cap
  } else if (capacity === '' || capacity === null) {
    data.capacity = null
  }
  if (description !== undefined) data.description = description || null
  if (academicYearId !== undefined) {
    data.academicYearId = academicYearId ? Number.parseInt(academicYearId, 10) : null
  }
  return data
}

exports.getAllClasses = async (req, res) => {
  try {
    const where = {}

    // Teachers see only the classes they teach via teaching assignments.
    // Students see only their own class.
    if (req.user?.role === 'STUDENT') {
      const profile = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { classId: true }
      })
      if (!profile?.classId) {
        return res.json({ success: true, data: [] })
      }
      where.id = profile.classId
    }
    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      if (!teacherProfileId) {
        return res.json({ success: true, data: [] })
      }
      const classIds = await getTeacherClassIds(teacherProfileId)
      if (classIds.length === 0) return res.json({ success: true, data: [] })
      where.id = { in: classIds }
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        teachers: { select: { id: true, name: true, email: true } },
        roomRef: { select: { id: true, name: true, building: true, capacity: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
        _count: { select: { students: true, teachers: true, teachingAssignments: true } }
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }]
    })
    return res.json({ success: true, data: classes })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching classes.', error: error.message })
  }
}

exports.getClassById = async (req, res) => {
  try {
    const { id } = req.params
    const klass = await prisma.class.findUnique({
      where: { id: Number.parseInt(id, 10) },
      include: {
        students: {
          select: { id: true, name: true, email: true, grade: true, status: true },
          orderBy: { name: 'asc' }
        },
        teachers: { select: { id: true, name: true, email: true, subject: true } },
        roomRef: { select: { id: true, name: true, building: true, capacity: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
        teachingAssignments: {
          include: {
            teacher: { select: { id: true, name: true } },
            course: { select: { id: true, title: true, code: true, coefficient: true } }
          }
        }
      }
    })
    if (!klass) return res.status(404).json({ message: 'Class not found.' })
    return res.json({ success: true, data: klass })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching class.', error: error.message })
  }
}

exports.createClass = async (req, res) => {
  try {
    const { name, educationLevel, level, grade } = req.body
    if (!name || !(educationLevel || level) || !grade) {
      return res.status(400).json({
        message: 'Please provide name, education level, and grade.'
      })
    }
    const data = buildClassData(req.body)
    if (!data.room) data.room = 'TBD'

    if (data.roomId) {
      const room = await prisma.room.findUnique({ where: { id: data.roomId }, select: { name: true } })
      if (!room) {
        return res.status(400).json({ message: 'Selected room was not found.' })
      }
      data.room = room.name
    }
    if (!data.level) {
      return res.status(400).json({ message: 'Education level must be Primary or Secondary.' })
    }
    if (!data.grade) {
      return res.status(400).json({ message: 'Grade is required.' })
    }

    if (!data.academicYearId) {
      const activeYear = await prisma.academicYear.findFirst({
        where: { isActive: true, isArchived: false },
        select: { id: true }
      })
      if (activeYear) data.academicYearId = activeYear.id
    }

    const klass = await prisma.class.create({ data })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'CLASS_CREATE',
      entityType: 'Class',
      entityId: klass.id,
      after: klass
    })
    return res.status(201).json({ success: true, data: klass, message: 'Class created.' })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error creating class.' })
  }
}

exports.updateClass = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.id, 10)
    const data = buildClassData(req.body)

    if (data.roomId) {
      const room = await prisma.room.findUnique({ where: { id: data.roomId }, select: { name: true } })
      if (!room) {
        return res.status(400).json({ message: 'Selected room was not found.' })
      }
      data.room = room.name
    }

    const updated = await prisma.class.update({ where: { id: classId }, data })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'CLASS_UPDATE',
      entityType: 'Class',
      entityId: updated.id,
      after: updated
    })
    return res.json({ success: true, data: updated, message: 'Class updated.' })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error updating class.' })
  }
}

exports.deleteClass = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const studentCount = await prisma.student.count({ where: { classId: id } })
    if (studentCount > 0) {
      return res.status(400).json({ message: 'Cannot delete class while students are still assigned to it.' })
    }
    await prisma.class.delete({ where: { id } })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'CLASS_DELETE',
      entityType: 'Class',
      entityId: id
    })
    return res.json({ success: true, message: 'Class deleted.' })
  } catch (error) {
    return res.status(400).json({ message: 'Error deleting class.', error: error.message })
  }
}

exports.addStudentToClass = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.id, 10)
    const studentId = Number.parseInt(req.body.studentId, 10)
    if (!studentId) {
      return res.status(400).json({ message: 'studentId is required.' })
    }

    // Capacity guard
    const klass = await prisma.class.findUnique({
      where: { id: classId },
      select: { capacity: true, _count: { select: { students: true } } }
    })
    if (!klass) return res.status(404).json({ message: 'Class not found.' })
    if (klass.capacity && klass._count.students >= klass.capacity) {
      return res.status(400).json({ message: 'Class capacity reached.' })
    }

    const student = await prisma.student.update({
      where: { id: studentId },
      data: { classId },
      include: { class: true }
    })
    return res.json({ success: true, data: student, message: 'Student assigned to class.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error assigning student to class.', error: error.message })
  }
}

exports.removeStudentFromClass = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.id, 10)
    const studentId = Number.parseInt(req.params.studentId, 10)
    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student || student.classId !== classId) {
      return res.status(404).json({ message: 'Student is not assigned to this class.' })
    }
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { classId: null }
    })
    return res.json({ success: true, data: updated, message: 'Student removed from class.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error removing student from class.', error: error.message })
  }
}

exports.addTeacherToClass = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.id, 10)
    const teacherId = Number.parseInt(req.body.teacherId, 10)
    if (!teacherId) {
      return res.status(400).json({ message: 'teacherId is required.' })
    }
    const klass = await prisma.class.update({
      where: { id: classId },
      data: { teachers: { connect: { id: teacherId } } },
      include: { teachers: { select: { id: true, name: true, email: true } } }
    })
    return res.json({ success: true, data: klass, message: 'Teacher assigned to class.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error assigning teacher to class.', error: error.message })
  }
}

exports.removeTeacherFromClass = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.id, 10)
    const teacherId = Number.parseInt(req.params.teacherId, 10)
    const klass = await prisma.class.update({
      where: { id: classId },
      data: { teachers: { disconnect: { id: teacherId } } },
      include: { teachers: { select: { id: true, name: true, email: true } } }
    })
    return res.json({ success: true, data: klass, message: 'Teacher removed from class.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error removing teacher from class.', error: error.message })
  }
}

exports.generateClassTimetable = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.id, 10)
    if (!Number.isInteger(classId) || classId <= 0) {
      return res.status(400).json({ message: 'Invalid class id.' })
    }

    const klass = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true }
    })
    if (!klass) return res.status(404).json({ message: 'Class not found.' })

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const allowedClassIds = teacherProfileId ? await getTeacherClassIds(teacherProfileId) : []
      if (!allowedClassIds.includes(classId)) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to this class.' })
      }
    }

    const { assignments: allAssignments, rooms } = await prepareAssignmentsWithAutoRooms()
    if (!rooms.length) {
      return res.status(400).json({ message: 'Create at least one room first.' })
    }

    const classAssignments = allAssignments.filter((row) => row.class?.id === classId)

    if (!classAssignments.length) {
      return res.status(400).json({
        message: 'No teaching assignments for this class. Assign teachers and subjects first.'
      })
    }

    const scheduling = createSchedulingPlan(allAssignments, rooms)
    const content = formatClassTimetableGridHtml(classAssignments, klass.name, '', scheduling)

    return res.json({
      success: true,
      data: {
        classId: klass.id,
        className: klass.name,
        content
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error generating class timetable.', error: error.message })
  }
}
