const express = require('express')
const router = express.Router()
const messageController = require('../controllers/message.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, authorize('ADMIN', 'TEACHER', 'PARENT'), messageController.listMessages)
router.get('/contacts', protect, authorize('ADMIN', 'TEACHER', 'PARENT'), messageController.getContacts)
router.get('/inbox', protect, authorize('ADMIN', 'TEACHER', 'PARENT'), messageController.getInbox)
router.get('/sent', protect, authorize('ADMIN', 'TEACHER', 'PARENT'), messageController.getSent)
router.post('/', protect, authorize('ADMIN', 'TEACHER', 'PARENT'), messageController.sendMessage)
router.patch('/:id/read', protect, authorize('ADMIN', 'TEACHER', 'PARENT'), messageController.markAsRead)

module.exports = router
