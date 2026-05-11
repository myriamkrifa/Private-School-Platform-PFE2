const express = require('express')
const router = express.Router()
const notificationController = require('../controllers/notification.controller')
const { protect } = require('../middlewares/auth.middleware')

router.get('/me', protect, notificationController.getMyNotifications)
router.patch('/:id/read', protect, notificationController.markAsRead)
router.patch('/me/read-all', protect, notificationController.markAllAsRead)

module.exports = router
