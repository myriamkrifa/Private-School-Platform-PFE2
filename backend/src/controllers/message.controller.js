const prisma = require('../prisma')

const senderInclude = {
  sender: { select: { id: true, name: true, role: true, email: true } }
}
const recipientInclude = {
  recipient: { select: { id: true, name: true, role: true, email: true } }
}

exports.getInbox = async (req, res) => {
  try {
    const inbox = await prisma.message.findMany({
      where: { recipientId: req.user.id },
      include: { ...senderInclude, ...recipientInclude },
      orderBy: { createdAt: 'desc' }
    })

    return res.json({ success: true, data: inbox })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching inbox.', error: error.message })
  }
}

exports.getSent = async (req, res) => {
  try {
    const sent = await prisma.message.findMany({
      where: { senderId: req.user.id },
      include: { ...senderInclude, ...recipientInclude },
      orderBy: { createdAt: 'desc' }
    })

    return res.json({ success: true, data: sent })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching sent messages.', error: error.message })
  }
}

exports.listMessages = async (req, res) => {
  try {
    const userId = req.user.id
    const messages = await prisma.message.findMany({
      where: { OR: [{ recipientId: userId }, { senderId: userId }] },
      include: { ...senderInclude, ...recipientInclude },
      orderBy: { createdAt: 'desc' }
    })
    return res.json({ success: true, data: messages })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching messages.', error: error.message })
  }
}

// Return users a sender can message based on role + linked relations.
exports.getContacts = async (req, res) => {
  try {
    const role = req.user.role
    const userId = req.user.id

    if (role === 'ADMIN') {
      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }]
      })
      return res.json({ success: true, data: users })
    }

    if (role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId },
        select: { id: true }
      })
      if (!teacher) return res.json({ success: true, data: [] })

      const assignments = await prisma.teachingAssignment.findMany({
        where: { teacherId: teacher.id },
        select: { classId: true }
      })
      const classIds = Array.from(new Set(assignments.map((a) => a.classId)))
      if (classIds.length === 0) return res.json({ success: true, data: [] })

      const studentIds = await prisma.student.findMany({
        where: { classId: { in: classIds } },
        select: { id: true }
      })
      const parentLinks = await prisma.parentStudent.findMany({
        where: { studentId: { in: studentIds.map((s) => s.id) } },
        select: { parentId: true }
      })
      const parentIds = Array.from(new Set(parentLinks.map((p) => p.parentId)))
      if (parentIds.length === 0) return res.json({ success: true, data: [] })

      const parents = await prisma.user.findMany({
        where: { id: { in: parentIds } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' }
      })
      return res.json({ success: true, data: parents })
    }

    if (role === 'PARENT') {
      const links = await prisma.parentStudent.findMany({
        where: { parentId: userId },
        include: { student: { select: { classId: true } } }
      })
      const classIds = Array.from(
        new Set(links.map((link) => link.student?.classId).filter(Boolean))
      )
      if (classIds.length === 0) return res.json({ success: true, data: [] })

      const assignments = await prisma.teachingAssignment.findMany({
        where: { classId: { in: classIds } },
        include: { teacher: { select: { userId: true, name: true, email: true } } }
      })
      const teacherUsers = await prisma.user.findMany({
        where: {
          id: { in: assignments.map((a) => a.teacher?.userId).filter(Boolean) }
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' }
      })
      return res.json({ success: true, data: teacherUsers })
    }

    return res.json({ success: true, data: [] })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching contacts.', error: error.message })
  }
}

exports.markAsRead = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const message = await prisma.message.findUnique({ where: { id } })
    if (!message) return res.status(404).json({ message: 'Message not found.' })
    if (message.recipientId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden.' })
    }
    const updated = await prisma.message.update({ where: { id }, data: { isRead: true } })
    return res.json({ success: true, data: updated, message: 'Message marked as read.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error updating message.', error: error.message })
  }
}

exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, content, subject } = req.body

    if (!recipientId || !content) {
      return res.status(400).json({ message: 'Please provide recipientId and content.' })
    }

    const recipient = await prisma.user.findUnique({
      where: { id: Number.parseInt(recipientId, 10) }
    })
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found.' })
    }

    const senderRole = req.user.role
    const recipientRole = recipient.role

    const teacherParent =
      (senderRole === 'TEACHER' && recipientRole === 'PARENT') ||
      (senderRole === 'PARENT' && recipientRole === 'TEACHER')

    if (senderRole !== 'ADMIN' && !teacherParent) {
      return res.status(403).json({
        message: 'Only teacher↔parent messaging is allowed for non-admin users.'
      })
    }

    const msg = await prisma.message.create({
      data: {
        senderId: req.user.id,
        recipientId: Number.parseInt(recipientId, 10),
        subject: subject ? String(subject).trim() : null,
        content
      },
      include: { ...senderInclude, ...recipientInclude }
    })

    await prisma.notification.create({
      data: {
        userId: Number.parseInt(recipientId, 10),
        type: 'MESSAGE',
        title: 'New message',
        message: subject ? `New message: ${subject}` : 'You received a new message.'
      }
    })

    return res.status(201).json({ success: true, data: msg, message: 'Message sent.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error sending message.', error: error.message })
  }
}
