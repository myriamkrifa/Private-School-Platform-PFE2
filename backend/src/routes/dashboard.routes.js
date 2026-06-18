const express = require('express')
const router = express.Router()
const controller = require('../controllers/dashboard.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/admin/dashboard', protect, authorize('ADMIN'), controller.getAdminDashboard)
router.get('/teacher/dashboard', protect, authorize('TEACHER'), controller.getTeacherDashboard)
router.get('/parent/dashboard', protect, authorize('PARENT'), controller.getParentDashboard)
router.get('/student/dashboard', protect, authorize('STUDENT'), controller.getStudentDashboard)
router.get('/calendar/events', protect, controller.getCalendarEvents)
router.post('/calendar/events', protect, authorize('ADMIN'), controller.createCalendarEvent)
router.delete('/calendar/events/:id', protect, authorize('ADMIN'), controller.deleteCalendarEvent)

module.exports = router
