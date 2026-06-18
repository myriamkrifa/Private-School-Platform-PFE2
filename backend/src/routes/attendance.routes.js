const express = require('express')
const router = express.Router()
const attendanceController = require('../controllers/attendance.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.post('/', protect, authorize('ADMIN', 'TEACHER'), attendanceController.markAttendance)
router.post('/bulk-upsert', protect, authorize('ADMIN', 'TEACHER'), attendanceController.bulkUpsertAttendance)
router.get('/mark-sheet/:classId', protect, authorize('ADMIN', 'TEACHER'), attendanceController.getAttendanceMarkSheet)
router.get('/class/:classId', protect, authorize('ADMIN', 'TEACHER'), attendanceController.getClassAttendance)
router.get('/me', protect, authorize('STUDENT'), attendanceController.getMyAttendance)
router.get('/student/:studentId', protect, authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), attendanceController.getStudentAttendance)
router.patch('/:id', protect, authorize('ADMIN', 'TEACHER'), attendanceController.updateAttendance)
router.patch('/:id/justify', protect, authorize('ADMIN', 'TEACHER', 'PARENT'), attendanceController.justifyAbsence)

module.exports = router
