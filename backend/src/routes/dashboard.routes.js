const express = require('express')
const router = express.Router()
const controller = require('../controllers/dashboard.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/admin/dashboard', protect, authorize('ADMIN'), controller.getAdminDashboard)
router.get('/teacher/dashboard', protect, authorize('TEACHER'), controller.getTeacherDashboard)
router.get('/parent/dashboard', protect, authorize('PARENT'), controller.getParentDashboard)
router.get('/student/dashboard', protect, authorize('STUDENT'), controller.getStudentDashboard)

module.exports = router
