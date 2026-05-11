const prisma = require('../prisma')

exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      select: { id: true, userId: true, name: true, email: true, subject: true }
    })
    res.json({ success: true, data: teachers })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teachers.', error: error.message })
  }
}

exports.getTeacherById = async (req, res) => {
  try {
    const { id } = req.params
    const teacher = await prisma.teacher.findUnique({
      where: { id: parseInt(id) }
    })
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' })
    res.json({ success: true, data: teacher })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teacher.', error: error.message })
  }
}

exports.createTeacher = async (req, res) => {
  try {
    const { userId, name, email, subject } = req.body
    const parsedUserId = Number.parseInt(userId, 10)

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ message: 'Please provide subject.' })
    }

    let user = null
    if (Number.isInteger(parsedUserId) && parsedUserId > 0) {
      user = await prisma.user.findUnique({
        where: { id: parsedUserId },
        select: { id: true, name: true, email: true, role: true }
      })
    } else if (email && String(email).trim()) {
      user = await prisma.user.findUnique({
        where: { email: String(email).trim() },
        select: { id: true, name: true, email: true, role: true }
      })
    }

    if (!user || user.role !== 'TEACHER') {
      return res.status(400).json({ message: 'Please provide userId or email for an existing TEACHER account.' })
    }

    const existingProfile = await prisma.teacher.findUnique({ where: { userId: user.id } })
    if (existingProfile) {
      return res.status(409).json({ message: 'This TEACHER account already has a teacher profile.' })
    }

    const finalName = name && String(name).trim() ? String(name).trim() : user.name
    const finalSubject = String(subject).trim()

    const teacher = await prisma.$transaction(async (tx) => {
      if (finalName !== user.name) {
        await tx.user.update({
          where: { id: user.id },
          data: { name: finalName }
        })
      }

      return tx.teacher.create({
        data: {
          userId: user.id,
          name: finalName,
          email: user.email,
          subject: finalSubject
        }
      })
    })

    res.status(201).json({ success: true, data: teacher, message: 'Teacher created.' })
  } catch (error) {
    res.status(500).json({ message: 'Error creating teacher.', error: error.message })
  }
}

exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params
    await prisma.teacher.delete({
      where: { id: parseInt(id) }
    })
    res.json({ success: true, message: 'Teacher deleted.' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting teacher.', error: error.message })
  }
}
