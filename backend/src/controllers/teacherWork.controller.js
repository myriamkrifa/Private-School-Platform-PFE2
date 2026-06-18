const prisma = require('../prisma')
const {
  getTeacherProfileId,
  getTeacherClassIds,
  teacherHasClassAccess,
  getSubjectsForTeacherClass
} = require('../services/teacherClassAccess.service')

exports.getMyClasses = async (req, res) => {
  try {
    const teacherProfileId = await getTeacherProfileId(req.user.id)
    if (!teacherProfileId) {
      return res.json({ success: true, data: [] })
    }
    const classIds = await getTeacherClassIds(teacherProfileId)
    const classes = await prisma.class.findMany({
      where: { id: { in: classIds } },
      orderBy: [{ level: 'asc' }, { name: 'asc' }]
    })
    return res.json({ success: true, data: classes })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching teacher classes.', error: error.message })
  }
}

exports.getClassStudents = async (req, res) => {
  try {
    const classId = Number.parseInt(req.params.classId, 10)
    const teacherProfileId = await getTeacherProfileId(req.user.id)
    const allowed = await teacherHasClassAccess(teacherProfileId, classId)
    if (!allowed) {
      return res.status(403).json({ message: 'Forbidden for this class.' })
    }
    const students = await prisma.student.findMany({
      where: { classId },
      select: { id: true, name: true, email: true, grade: true, enrollmentDate: true },
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
    const allowed = await teacherHasClassAccess(teacherProfileId, classId)
    if (!allowed) {
      return res.status(403).json({ message: 'Forbidden for this class.' })
    }
    const subjects = await getSubjectsForTeacherClass(teacherProfileId, classId)
    return res.json({ success: true, data: subjects })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching class subjects.', error: error.message })
  }
}
