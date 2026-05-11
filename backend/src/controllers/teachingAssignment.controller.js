const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')

exports.createTeachingAssignment = async (req, res) => {
  try {
    const { teacherId, classId, courseId } = req.body
    if (!teacherId || !classId || !courseId) {
      return res.status(400).json({ message: 'teacherId, classId and courseId are required.' })
    }

    // Validate the references exist before upsert
    const [teacher, klass, course] = await Promise.all([
      prisma.teacher.findUnique({ where: { id: Number(teacherId) } }),
      prisma.class.findUnique({ where: { id: Number(classId) } }),
      prisma.course.findUnique({ where: { id: Number(courseId) } })
    ])
    if (!teacher) return res.status(400).json({ message: 'Teacher not found.' })
    if (!klass) return res.status(400).json({ message: 'Class not found.' })
    if (!course) return res.status(400).json({ message: 'Subject/course not found.' })

    const created = await prisma.teachingAssignment.upsert({
      where: {
        teacherId_classId_courseId: {
          teacherId: Number(teacherId),
          classId: Number(classId),
          courseId: Number(courseId)
        }
      },
      create: {
        teacherId: Number(teacherId),
        classId: Number(classId),
        courseId: Number(courseId)
      },
      update: {}
    })

    // Best-effort: ensure the M-N teacher↔class relation is also set so the
    // class details page lists the teacher by name immediately.
    try {
      await prisma.class.update({
        where: { id: Number(classId) },
        data: { teachers: { connect: { id: Number(teacherId) } } }
      })
    } catch (_e) {
      // already connected, ignore
    }

    await createAuditLog({
      actorId: req.user?.id,
      action: 'TEACHING_ASSIGNMENT_CREATE',
      entityType: 'TeachingAssignment',
      entityId: created.id,
      after: { teacherId, classId, courseId }
    })

    return res.status(201).json({ success: true, data: created, message: 'Teaching assignment saved.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error creating teaching assignment.', error: error.message })
  }
}

exports.getTeachingAssignments = async (_req, res) => {
  try {
    const data = await prisma.teachingAssignment.findMany({
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        class: { select: { id: true, name: true, room: true } },
        course: { select: { id: true, title: true, code: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching teaching assignments.', error: error.message })
  }
}

exports.deleteTeachingAssignment = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    await prisma.teachingAssignment.delete({ where: { id } })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'TEACHING_ASSIGNMENT_DELETE',
      entityType: 'TeachingAssignment',
      entityId: id
    })
    return res.json({ success: true, message: 'Teaching assignment removed.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting teaching assignment.', error: error.message })
  }
}
