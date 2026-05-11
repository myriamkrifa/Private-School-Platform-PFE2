const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')

const getTeacherProfileId = async (userId) => {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: Number(userId) },
    select: { id: true }
  })
  return teacher?.id || null
}

exports.getAllCourses = async (_req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json({ success: true, data: courses })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching courses.', error: error.message })
  }
}

exports.createCourse = async (req, res) => {
  try {
    const { title, description, classId, code, coefficient } = req.body
    if (!title) {
      return res.status(400).json({ message: 'Please provide course title.' })
    }

    const data = {
      title: String(title).trim(),
      description: description || null,
      classId: classId ? Number.parseInt(classId, 10) : null,
      teacherId: req.user?.id || null
    }
    if (code !== undefined) data.code = code ? String(code).trim().toUpperCase() : null
    if (coefficient !== undefined) {
      const coef = Number(coefficient)
      if (Number.isFinite(coef) && coef > 0) data.coefficient = coef
    }

    const created = await prisma.course.create({ data })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'COURSE_CREATE',
      entityType: 'Course',
      entityId: created.id,
      after: created
    })

    return res.status(201).json({ success: true, data: created, message: 'Course created.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error creating course.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// Course materials
// ─────────────────────────────────────────────
exports.addCourseMaterial = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10)
    const { title, fileUrl, description, content } = req.body

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Please provide a material title.' })
    }
    if (!fileUrl && !content) {
      return res.status(400).json({ message: 'Please provide either a file URL or text content.' })
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true }
    })
    if (!course) return res.status(404).json({ message: 'Course not found.' })

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const allowed = await prisma.teachingAssignment.findFirst({
        where: { teacherId: teacherProfileId, courseId }
      })
      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to this subject.' })
      }
    }

    const material = await prisma.courseMaterial.create({
      data: {
        courseId,
        title: String(title).trim(),
        fileUrl: fileUrl || null,
        description: description || null,
        content: content || null
      }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'COURSE_MATERIAL_CREATE',
      entityType: 'CourseMaterial',
      entityId: material.id,
      after: { courseId: material.courseId, title: material.title }
    })

    return res.status(201).json({ success: true, data: material, message: 'Course material added.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error adding course material.', error: error.message })
  }
}

exports.getCourseMaterials = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10)
    const materials = await prisma.courseMaterial.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' }
    })
    return res.json({ success: true, data: materials })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching course materials.', error: error.message })
  }
}

exports.listCourseMaterials = async (req, res) => {
  try {
    const where = {}

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const subjects = await prisma.teachingAssignment.findMany({
        where: { teacherId: teacherProfileId },
        select: { courseId: true }
      })
      const ids = Array.from(new Set(subjects.map((s) => s.courseId)))
      if (ids.length === 0) return res.json({ success: true, data: [] })
      where.courseId = { in: ids }
    }

    if (req.user?.role === 'STUDENT') {
      const profile = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { classId: true }
      })
      if (!profile?.classId) return res.json({ success: true, data: [] })
      const subjects = await prisma.teachingAssignment.findMany({
        where: { classId: profile.classId },
        select: { courseId: true }
      })
      const ids = Array.from(new Set(subjects.map((s) => s.courseId)))
      if (ids.length === 0) return res.json({ success: true, data: [] })
      where.courseId = { in: ids }
    }

    if (req.user?.role === 'PARENT') {
      const links = await prisma.parentStudent.findMany({
        where: { parentId: req.user.id },
        include: { student: { select: { classId: true } } }
      })
      const classIds = Array.from(
        new Set(links.map((link) => link.student?.classId).filter(Boolean))
      )
      if (classIds.length === 0) return res.json({ success: true, data: [] })
      const subjects = await prisma.teachingAssignment.findMany({
        where: { classId: { in: classIds } },
        select: { courseId: true }
      })
      const ids = Array.from(new Set(subjects.map((s) => s.courseId)))
      if (ids.length === 0) return res.json({ success: true, data: [] })
      where.courseId = { in: ids }
    }

    const materials = await prisma.courseMaterial.findMany({
      where,
      include: { course: { select: { id: true, title: true, code: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return res.json({ success: true, data: materials })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching course materials.', error: error.message })
  }
}

exports.deleteCourseMaterial = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const existing = await prisma.courseMaterial.findUnique({
      where: { id },
      select: { id: true, courseId: true }
    })
    if (!existing) return res.status(404).json({ message: 'Course material not found.' })

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const allowed = await prisma.teachingAssignment.findFirst({
        where: { teacherId: teacherProfileId, courseId: existing.courseId }
      })
      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to this subject.' })
      }
    }

    await prisma.courseMaterial.delete({ where: { id } })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'COURSE_MATERIAL_DELETE',
      entityType: 'CourseMaterial',
      entityId: id
    })
    return res.json({ success: true, message: 'Course material deleted.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting course material.', error: error.message })
  }
}
