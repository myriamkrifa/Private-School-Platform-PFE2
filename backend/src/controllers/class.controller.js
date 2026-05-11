const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')

const buildClassData = (body) => {
  const { name, room, level, academicYearId, capacity, description } = body
  const data = {}
  if (name !== undefined) data.name = String(name).trim()
  if (room !== undefined) data.room = String(room).trim()
  if (level && (level === 'PRIMARY' || level === 'SECONDARY')) data.level = level
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
      const profile = await prisma.teacher.findUnique({
        where: { userId: req.user.id },
        select: { id: true }
      })
      if (profile) {
        const teaching = await prisma.teachingAssignment.findMany({
          where: { teacherId: profile.id },
          select: { classId: true }
        })
        const classIds = Array.from(new Set(teaching.map((t) => t.classId)))
        if (classIds.length === 0) return res.json({ success: true, data: [] })
        where.id = { in: classIds }
      }
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        teachers: { select: { id: true, name: true, email: true } },
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
    const { name, room } = req.body
    if (!name || !room) {
      return res.status(400).json({ message: 'Please provide name and room.' })
    }
    const data = buildClassData(req.body)
    if (!data.level) data.level = 'PRIMARY'

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
