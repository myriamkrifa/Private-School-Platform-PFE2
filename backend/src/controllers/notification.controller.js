const prisma = require('../prisma')

exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    })

    return res.json({ success: true, data: notifications })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching notifications.', error: error.message })
  }
}

exports.markAsRead = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    })
    return res.json({ success: true, data: notification, message: 'Notification marked as read.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error marking notification as read.', error: error.message })
  }
}

exports.markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    })
    return res.json({ success: true, message: 'All notifications marked as read.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error marking notifications as read.', error: error.message })
  }
}
