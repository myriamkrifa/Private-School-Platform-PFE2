const prisma = require('../prisma')

exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        subject: true,
        specialty: true,
        status: true
      },
      orderBy: { name: 'asc' }
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

const TEACHER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE']

exports.updateTeacher = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid teacher id.' })
    }

    const existing = await prisma.teacher.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ message: 'Teacher not found.' })
    }

    const { name, email, subject, firstName, lastName, phone, specialty, hireDate, status } = req.body
    const data = {}

    if (name !== undefined) {
      const trimmed = String(name).trim()
      if (!trimmed) return res.status(400).json({ message: 'Name is required.' })
      data.name = trimmed
    }
    if (email !== undefined) {
      const trimmed = String(email).trim()
      if (!trimmed) return res.status(400).json({ message: 'Email is required.' })
      data.email = trimmed
    }
    if (subject !== undefined) {
      const trimmed = String(subject).trim()
      if (!trimmed) return res.status(400).json({ message: 'Subject is required.' })
      data.subject = trimmed
    }
    if (firstName !== undefined) {
      data.firstName = firstName && String(firstName).trim() ? String(firstName).trim() : null
    }
    if (lastName !== undefined) {
      data.lastName = lastName && String(lastName).trim() ? String(lastName).trim() : null
    }
    if (phone !== undefined) {
      data.phone = phone && String(phone).trim() ? String(phone).trim() : null
    }
    if (specialty !== undefined) {
      data.specialty = specialty && String(specialty).trim() ? String(specialty).trim() : null
    }
    if (hireDate !== undefined) {
      data.hireDate = hireDate ? new Date(hireDate) : null
      if (hireDate && Number.isNaN(data.hireDate.getTime())) {
        return res.status(400).json({ message: 'Invalid hire date.' })
      }
    }
    if (status !== undefined) {
      if (!TEACHER_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid teacher status.' })
      }
      data.status = status
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No fields to update.' })
    }

    const teacher = await prisma.$transaction(async (tx) => {
      const updated = await tx.teacher.update({ where: { id }, data })

      if (existing.userId && (data.name || data.email)) {
        const userData = {}
        if (data.name) userData.name = data.name
        if (data.email) userData.email = data.email
        await tx.user.update({
          where: { id: existing.userId },
          data: userData
        })
      }

      return updated
    })

    res.json({ success: true, data: teacher, message: 'Teacher updated.' })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Email already in use.' })
    }
    res.status(500).json({ message: 'Error updating teacher.', error: error.message })
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
