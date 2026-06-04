const prisma = require('../prisma')

exports.getMyChildren = async (req, res) => {
  try {
    if (req.user?.role !== 'PARENT') {
      return res.status(403).json({ message: 'Only parent accounts can access linked children.' })
    }

    const links = await prisma.parentStudent.findMany({
      where: { parentId: req.user.id },
      include: {
        student: {
          include: {
            class: { select: { id: true, name: true, room: true } },
            grades: {
              orderBy: { recordedAt: 'desc' },
              take: 5,
              select: { id: true, subject: true, score: true, maxScore: true, recordedAt: true }
            },
            attendances: {
              orderBy: { date: 'desc' },
              take: 7,
              select: { id: true, date: true, status: true, justification: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const children = links.map((link) => link.student)
    return res.json({ success: true, data: children })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching linked children.', error: error.message })
  }
}

exports.getAllStudents = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        grade: true,
        classId: true,
        status: true,
        class: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' }
    })
    res.json({ success: true, data: students })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students.', error: error.message })
  }
}

exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params
    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: {
        class: { select: { id: true, name: true, room: true } },
        parentLinks: {
          include: { parent: { select: { id: true, name: true, email: true } } }
        }
      }
    })
    if (!student) return res.status(404).json({ message: 'Student not found.' })
    res.json({ success: true, data: student })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching student.', error: error.message })
  }
}

exports.createStudent = async (req, res) => {
  try {
    const { userId, name, email, grade } = req.body
    const parsedUserId = Number.parseInt(userId, 10)

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

    if (!user || user.role !== 'STUDENT') {
      return res.status(400).json({ message: 'Please provide userId or email for an existing STUDENT account.' })
    }

    const existingProfile = await prisma.student.findUnique({ where: { userId: user.id } })
    if (existingProfile) {
      return res.status(409).json({ message: 'This STUDENT account already has a student profile.' })
    }

    const finalName = name && String(name).trim() ? String(name).trim() : user.name
    const finalGrade = grade && String(grade).trim() ? String(grade).trim() : 'N/A'

    const student = await prisma.$transaction(async (tx) => {
      if (finalName !== user.name) {
        await tx.user.update({
          where: { id: user.id },
          data: { name: finalName }
        })
      }

      return tx.student.create({
        data: {
          userId: user.id,
          name: finalName,
          email: user.email,
          grade: finalGrade
        }
      })
    })

    res.status(201).json({ success: true, data: student, message: 'Student created.' })
  } catch (error) {
    res.status(500).json({ message: 'Error creating student.', error: error.message })
  }
}

const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED']

exports.updateStudent = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid student id.' })
    }

    const existing = await prisma.student.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ message: 'Student not found.' })
    }

    const {
      name,
      email,
      grade,
      classId,
      firstName,
      lastName,
      birthDate,
      gender,
      address,
      phone,
      enrollmentDate,
      status
    } = req.body

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
    if (grade !== undefined) {
      const trimmed = String(grade).trim()
      if (!trimmed) return res.status(400).json({ message: 'Grade is required.' })
      data.grade = trimmed
    }
    if (firstName !== undefined) {
      data.firstName = firstName && String(firstName).trim() ? String(firstName).trim() : null
    }
    if (lastName !== undefined) {
      data.lastName = lastName && String(lastName).trim() ? String(lastName).trim() : null
    }
    if (gender !== undefined) {
      data.gender = gender && String(gender).trim() ? String(gender).trim() : null
    }
    if (address !== undefined) {
      data.address = address && String(address).trim() ? String(address).trim() : null
    }
    if (phone !== undefined) {
      data.phone = phone && String(phone).trim() ? String(phone).trim() : null
    }
    if (birthDate !== undefined) {
      data.birthDate = birthDate ? new Date(birthDate) : null
      if (birthDate && Number.isNaN(data.birthDate.getTime())) {
        return res.status(400).json({ message: 'Invalid birth date.' })
      }
    }
    if (enrollmentDate !== undefined) {
      data.enrollmentDate = enrollmentDate ? new Date(enrollmentDate) : null
      if (enrollmentDate && Number.isNaN(data.enrollmentDate.getTime())) {
        return res.status(400).json({ message: 'Invalid enrollment date.' })
      }
    }
    if (status !== undefined) {
      if (!STUDENT_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid student status.' })
      }
      data.status = status
    }
    if (classId !== undefined) {
      if (classId === null || classId === '' || classId === 'none') {
        data.classId = null
      } else {
        const parsedClassId = Number.parseInt(classId, 10)
        if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
          return res.status(400).json({ message: 'Invalid class.' })
        }
        const klass = await prisma.class.findUnique({ where: { id: parsedClassId } })
        if (!klass) {
          return res.status(400).json({ message: 'Class not found.' })
        }
        data.classId = parsedClassId
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No fields to update.' })
    }

    const student = await prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data,
        include: {
          class: { select: { id: true, name: true } }
        }
      })

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

    res.json({ success: true, data: student, message: 'Student updated.' })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Email already in use.' })
    }
    res.status(500).json({ message: 'Error updating student.', error: error.message })
  }
}

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params
    await prisma.student.delete({
      where: { id: parseInt(id) }
    })
    res.json({ success: true, message: 'Student deleted.' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting student.', error: error.message })
  }
}

exports.linkParentToStudent = async (req, res) => {
  try {
    const studentId = Number.parseInt(req.params.id, 10)
    const { parentUserId } = req.body

    if (!parentUserId) {
      return res.status(400).json({ message: 'Please provide parentUserId.' })
    }

    const parent = await prisma.user.findUnique({
      where: { id: Number.parseInt(parentUserId, 10) }
    })

    if (!parent || parent.role !== 'PARENT') {
      return res.status(400).json({ message: 'The selected user is not a parent account.' })
    }

    const link = await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: Number.parseInt(parentUserId, 10),
          studentId
        }
      },
      create: {
        parentId: Number.parseInt(parentUserId, 10),
        studentId
      },
      update: {}
    })

    res.status(201).json({ success: true, data: link, message: 'Parent linked to student.' })
  } catch (error) {
    res.status(500).json({ message: 'Error linking parent to student.', error: error.message })
  }
}

exports.getStudentProgress = async (req, res) => {
  try {
    const studentId = Number.parseInt(req.params.id, 10)

    const [grades, attendance] = await Promise.all([
      prisma.grade.findMany({ where: { studentId } }),
      prisma.attendance.findMany({ where: { studentId } })
    ])

    const gradeAverage =
      grades.length > 0
        ? grades.reduce((sum, g) => sum + g.score, 0) / grades.length
        : null

    const absences = attendance.filter((a) => a.status === 'ABSENT').length

    res.json({
      success: true,
      data: {
        gradesCount: grades.length,
        gradeAverage,
        attendanceCount: attendance.length,
        absences
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching student progress.', error: error.message })
  }
}
