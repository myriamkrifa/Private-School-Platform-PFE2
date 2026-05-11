const express = require('express')
const router = express.Router()
const attendanceController = require('../controllers/attendance.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.post('/', protect, authorize('ADMIN', 'TEACHER'), attendanceController.markAttendance)
router.post('/bulk-upsert', protect, authorize('ADMIN', 'TEACHER'), attendanceController.bulkUpsertAttendance)
router.get('/student/:studentId', protect, authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), attendanceController.getStudentAttendance)
router.patch('/:id/justify', protect, authorize('ADMIN', 'TEACHER', 'PARENT'), attendanceController.justifyAbsence)

module.exports = router
