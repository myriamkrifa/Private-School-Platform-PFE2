const prisma = require('../prisma')

const getTeacherProfileId = async (userId) => {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: Number(userId) },
    select: { id: true }
  })
  return teacher?.id || null
}

exports.getMyClasses = async (req, res) => {
  try {
    const teacherProfileId = await getTeacherProfileId(req.user.id)
    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId: teacherProfileId },
      include: { class: true }
    })
    const byId = new Map()
    assignments.forEach((a) => byId.set(a.class.id, a.class))
    return res.json({ success: true, data: Array.from(byId.values()) })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching teacher classes.', error: error.message })
  }
}

exports.getClassStudents = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)
    const teacherProfileId = await getTeacherProfileId(req.user.id)
    const allowed = await prisma.teachingAssignment.findFirst({ where: { teacherId: teacherProfileId, classId } })
    if (!allowed) {
      return res.status(403).json({ message: 'Forbidden for this class.' })
    }
    const students = await prisma.student.findMany({
      where: { classId },
      select: { id: true, name: true, email: true, grade: true },
      orderBy: { name: 'asc' }
    })
    return res.json({ success: true, data: students })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching class students.', error: error.message })
  }
}

exports.getClassSubjects = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)
    const teacherProfileId = await getTeacherProfileId(req.user.id)
    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId: teacherProfileId, classId },
      include: { course: { select: { id: true, title: true, description: true } } }
    })
    return res.json({ success: true, data: assignments.map((a) => a.course) })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching class subjects.', error: error.message })
  }
}
