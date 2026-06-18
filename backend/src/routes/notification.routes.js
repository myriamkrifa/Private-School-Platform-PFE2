const express = require('express')
const router = express.Router()
const notificationController = require('../controllers/notification.controller')
const { protect } = require('../middlewares/auth.middleware')

router.get('/me', protect, notificationController.getMyNotifications)
router.get('/me/unread-count', protect, notificationController.getUnreadCount)
router.patch('/me/read-all', protect, notificationController.markAllAsRead)
router.patch('/:id/read', protect, notificationController.markAsRead)

module.exports = router
