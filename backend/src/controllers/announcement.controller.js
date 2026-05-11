const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')

const ALLOWED_ROLES = ['ADMIN', 'TEACHER', 'PARENT', 'STUDENT']

// ─────────────────────────────────────────────
// GET /api/announcements
//   - Admins/Teachers see everything.
//   - Students/Parents see role + class targeted announcements only.
// ─────────────────────────────────────────────
exports.getAnnouncements = async (req, res) => {
  try {
    const role = req.user?.role
    const where = {}

    if (role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { classId: true }
      })
      where.OR = [
        { targetRole: null, classId: null },
        { targetRole: 'STUDENT' }
      ]
      if (student?.classId) {
        where.OR.push({ classId: student.classId })
      }
    } else if (role === 'PARENT') {
      const links = await prisma.parentStudent.findMany({
        where: { parentId: req.user.id },
        include: { student: { select: { classId: true } } }
      })
      const classIds = Array.from(
        new Set(links.map((link) => link.student?.classId).filter(Boolean))
      )
      where.OR = [
        { targetRole: null, classId: null },
        { targetRole: 'PARENT' }
      ]
      if (classIds.length) where.OR.push({ classId: { in: classIds } })
    }

    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        class: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json({ success: true, data: announcements })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching announcements.', error: error.message })
  }
}

// ─────────────────────────────────────────────
// POST /api/announcements
// ─────────────────────────────────────────────
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, targetRole, classId } = req.body
    if (!title || !content) {
      return res.status(400).json({ message: 'Please provide title and content.' })
    }

    let normalizedRole = null
    if (targetRole && targetRole !== '' && targetRole !== 'ALL') {
      if (!ALLOWED_ROLES.includes(targetRole)) {
        return res.status(400).json({ message: 'Invalid target role.' })
      }
      normalizedRole = targetRole
    }

    let normalizedClassId = null
    if (classId !== undefined && classId !== '' && classId !== null) {
      normalizedClassId = Number.parseInt(classId, 10)
      if (!Number.isInteger(normalizedClassId) || normalizedClassId <= 0) {
        return res.status(400).json({ message: 'Invalid classId.' })
      }
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: String(title).trim(),
        content,
        targetRole: normalizedRole,
        classId: normalizedClassId,
        createdById: req.user?.id
      }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'ANNOUNCEMENT_CREATE',
      entityType: 'Announcement',
      entityId: announcement.id,
      after: {
        title: announcement.title,
        targetRole: announcement.targetRole,
        classId: announcement.classId
      }
    })

    // Build target user set
    const userWhere = {}
    if (normalizedRole) userWhere.role = normalizedRole
    if (normalizedClassId) {
      const studentsInClass = await prisma.student.findMany({
        where: { classId: normalizedClassId },
        select: { userId: true }
      })
      const studentUserIds = studentsInClass.map((s) => s.userId).filter(Boolean)
      const parentLinks = await prisma.parentStudent.findMany({
        where: { studentId: { in: studentsInClass.map((s) => s.id) } },
        select: { parentId: true }
      })
      const targetIds = Array.from(
        new Set([...studentUserIds, ...parentLinks.map((p) => p.parentId)])
      )
      if (targetIds.length === 0) {
        return res.status(201).json({ success: true, data: announcement, message: 'Announcement published.' })
      }
      await prisma.notification.createMany({
        data: targetIds.map((userId) => ({
          userId,
          type: 'ANNOUNCEMENT',
          title: 'New announcement',
          message: announcement.title
        }))
      })
    } else {
      const targetUsers = await prisma.user.findMany({ where: userWhere, select: { id: true } })
      if (targetUsers.length > 0) {
        await prisma.notification.createMany({
          data: targetUsers.map((u) => ({
            userId: u.id,
            type: 'ANNOUNCEMENT',
            title: 'New announcement',
            message: announcement.title
          }))
        })
      }
    }

    return res.status(201).json({ success: true, data: announcement, message: 'Announcement published.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error creating announcement.', error: error.message })
  }
}
