const express = require('express')
const router = express.Router()
const announcementController = require('../controllers/announcement.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), announcementController.getAnnouncements)
router.post('/', protect, authorize('ADMIN', 'TEACHER'), announcementController.createAnnouncement)

module.exports = router
