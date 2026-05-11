const express = require('express')
const router = express.Router()
const controller = require('../controllers/report.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/class/:classId', protect, authorize('ADMIN', 'TEACHER'), controller.getClassReport)
router.get('/class/:classId/export', protect, authorize('ADMIN', 'TEACHER'), controller.exportClassReport)
router.get('/student/:studentId', protect, authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), controller.getStudentReport)
router.get('/teacher-workload', protect, authorize('ADMIN'), controller.getTeacherWorkloadReport)

module.exports = router
