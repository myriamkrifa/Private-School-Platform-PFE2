const prisma = require('../prisma')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { createAuditLog } = require('./audit.controller')
const { sendAccountApprovedEmail, sendParentAccountEmail } = require('../services/email.service')

const ALLOWED_ROLES = ['ADMIN', 'TEACHER', 'PARENT', 'STUDENT']

const generatePassword = (length = 12) => {
  const raw = crypto.randomBytes(32).toString('base64url').replace(/[^A-Za-z0-9]/g, '')
  const candidate = raw.slice(0, Math.max(length, 10))
  return `${candidate}A1`
}

const normalizeIdentityCardNumber = (value) => {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

const sanitizeEmailLocalPart = (value) => {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

const listUsers = async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { id: 'asc' }
    })

    return res.status(200).json({ users })
  } catch (error) {
    console.error('List users error:', error)
    return res.status(500).json({ message: 'Server error.' })
  }
}

const approveUser = async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10)

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid user id.' })
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (existingUser.isActive) {
      return res.status(400).json({ message: 'User is already approved and active.' })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'USER_APPROVE',
      entityType: 'User',
      entityId: updatedUser.id,
      before: { isActive: false },
      after: { isActive: true }
    })

    const emailResult = await sendAccountApprovedEmail({
      to: updatedUser.email,
      name: updatedUser.name
    })

    return res.status(200).json({
      message: 'User approved successfully.',
      user: updatedUser,
      emailNotification: emailResult
    })
  } catch (error) {
    console.error('Approve user error:', error)
    return res.status(500).json({ message: 'Server error.' })
  }
}

const updateUserRole = async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10)
    const { role } = req.body

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid user id.' })
    }

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(', ')}`
      })
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'USER_ROLE_UPDATE',
      entityType: 'User',
      entityId: updatedUser.id,
      before: { role: existingUser.role },
      after: { role: updatedUser.role }
    })

    return res.status(200).json({
      message: 'User role updated successfully.',
      user: updatedUser
    })
  } catch (error) {
    console.error('Update user role error:', error)
    return res.status(500).json({ message: 'Server error.' })
  }
}

const provisionStudentWithParent = async (req, res) => {
  try {
    const {
      studentFullName,
      studentEmail,
      parentName,
      parentIdentityCardNumber,
      parentPhoneNumber,
      parentEmail
    } = req.body

    if (!studentFullName || !studentEmail || !parentName || !parentIdentityCardNumber || !parentPhoneNumber) {
      return res.status(400).json({
        message: 'Please provide studentFullName, studentEmail, parentName, parentIdentityCardNumber, and parentPhoneNumber.'
      })
    }

    const normalizedParentEmail = parentEmail
      ? String(parentEmail).trim().toLowerCase()
      : null

    const normalizedStudentEmail = String(studentEmail).trim().toLowerCase()
    const normalizedParentIdentity = normalizeIdentityCardNumber(parentIdentityCardNumber)
    const normalizedParentPhone = String(parentPhoneNumber).trim()

    const [existingStudentUser, existingParentUser] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedStudentEmail } }),
      prisma.user.findFirst({
        where: {
          role: 'PARENT',
          identityCardNumber: normalizedParentIdentity
        }
      })
    ])

    if (existingStudentUser) {
      return res.status(409).json({ message: 'Student email is already used by another account.' })
    }

    const studentPlainPassword = generatePassword()
    let parentPlainPassword = null
    let parentHashedPassword = null
    let parentWasCreated = false

    // Only generate and hash password if creating a new parent
    if (!existingParentUser) {
      parentPlainPassword = generatePassword()
      parentHashedPassword = await bcrypt.hash(parentPlainPassword, 10)
      parentWasCreated = true
    }

    const studentHashedPassword = await bcrypt.hash(studentPlainPassword, 10)

    const created = await prisma.$transaction(async (tx) => {
      const studentUser = await tx.user.create({
        data: {
          name: String(studentFullName).trim(),
          email: normalizedStudentEmail,
          password: studentHashedPassword,
          role: 'STUDENT'
        },
        select: { id: true, name: true, email: true, role: true, createdAt: true }
      })

      const studentProfile = await tx.student.create({
        data: {
          userId: studentUser.id,
          name: studentUser.name,
          email: studentUser.email,
          grade: 'N/A'
        },
        select: { id: true, userId: true, name: true, email: true, grade: true }
      })

      let parentUser = existingParentUser
      if (!existingParentUser) {
        const parentLocal = sanitizeEmailLocalPart(normalizedParentIdentity)
        let generatedParentEmail = `parent.${parentLocal || crypto.randomBytes(4).toString('hex')}@school.com`
        const conflictByEmail = await tx.user.findUnique({ where: { email: generatedParentEmail } })
        if (conflictByEmail) {
          generatedParentEmail = `parent.${parentLocal || 'account'}.${Date.now()}@school.com`
        }

        parentUser = await tx.user.create({
          data: {
            name: String(parentName).trim(),
            email: generatedParentEmail,
            password: parentHashedPassword,
            role: 'PARENT',
            identityCardNumber: normalizedParentIdentity,
            phoneNumber: normalizedParentPhone,
            mustChangePassword: true
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            identityCardNumber: true,
            phoneNumber: true,
            createdAt: true
          }
        })
      }

      await tx.parentStudent.create({
        data: {
          parentId: parentUser.id,
          studentId: studentProfile.id
        }
      })

      return { studentUser, studentProfile, parentUser, parentWasCreated }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'ADMIN_PROVISION_STUDENT_PARENT',
      entityType: 'User',
      entityId: String(created.studentUser.id),
      metadata: {
        studentUserId: created.studentUser.id,
        studentProfileId: created.studentProfile.id,
        parentUserId: created.parentUser.id,
        parentWasCreated: created.parentWasCreated
      }
    })

    const message = created.parentWasCreated
      ? 'Student and parent accounts created successfully.'
      : 'Student account created and linked to existing parent account.'

    const response = {
      message,
      student: created.studentUser,
      parent: created.parentUser,
      credentials: {
        student: {
          email: created.studentUser.email,
          password: studentPlainPassword
        }
      }
    }

    // Only include parent password if parent was newly created
    if (created.parentWasCreated) {
      response.credentials.parent = {
        email: created.parentUser.email,
        password: parentPlainPassword
      }

      const parentNotifyEmail = normalizedParentEmail || created.parentUser.email
      response.emailNotification = await sendParentAccountEmail({
        to: parentNotifyEmail,
        parentName: created.parentUser.name,
        loginEmail: created.parentUser.email,
        temporaryPassword: parentPlainPassword,
        studentName: created.studentUser.name
      })
    }

    return res.status(201).json(response)
  } catch (error) {
    console.error('Provision student+parent error:', error)
    return res.status(500).json({ message: 'Server error.' })
  }
}

const provisionTeacher = async (req, res) => {
  try {
    const { teacherFullName, teacherEmail, subject } = req.body

    if (!teacherFullName || !teacherEmail) {
      return res.status(400).json({ message: 'Please provide teacherFullName and teacherEmail.' })
    }

    const normalizedTeacherEmail = String(teacherEmail).trim().toLowerCase()
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedTeacherEmail } })
    if (existingUser) {
      return res.status(409).json({ message: 'Teacher email is already used by another account.' })
    }

    const teacherPlainPassword = generatePassword()
    const teacherHashedPassword = await bcrypt.hash(teacherPlainPassword, 10)

    const created = await prisma.$transaction(async (tx) => {
      const teacherUser = await tx.user.create({
        data: {
          name: String(teacherFullName).trim(),
          email: normalizedTeacherEmail,
          password: teacherHashedPassword,
          role: 'TEACHER'
        },
        select: { id: true, name: true, email: true, role: true, createdAt: true }
      })

      await tx.teacher.create({
        data: {
          userId: teacherUser.id,
          name: teacherUser.name,
          email: teacherUser.email,
          subject: subject && String(subject).trim() ? String(subject).trim() : 'General'
        }
      })

      return teacherUser
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'ADMIN_PROVISION_TEACHER',
      entityType: 'User',
      entityId: String(created.id),
      metadata: { teacherUserId: created.id }
    })

    return res.status(201).json({
      message: 'Teacher account created successfully.',
      teacher: created,
      credentials: {
        teacher: {
          email: created.email,
          password: teacherPlainPassword
        }
      }
    })
  } catch (error) {
    console.error('Provision teacher error:', error)
    return res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = {
  listUsers,
  approveUser,
  updateUserRole,
  provisionStudentWithParent,
  provisionTeacher
}
