const express = require('express')
const router = express.Router()
const gradeController = require('../controllers/grade.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.post('/', protect, authorize('ADMIN', 'TEACHER'), gradeController.createGrade)
router.post('/bulk-upsert', protect, authorize('ADMIN', 'TEACHER'), gradeController.bulkUpsertGrades)
router.get('/me', protect, authorize('STUDENT'), gradeController.getMyGrades)
router.get('/me/average', protect, authorize('STUDENT'), gradeController.getMyAverage)
router.get('/student/:studentId', protect, authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), gradeController.getStudentGrades)
router.get('/student/:studentId/average', protect, authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), gradeController.getStudentAverage)
router.get('/class/:classId/average', protect, authorize('ADMIN', 'TEACHER', 'PARENT'), gradeController.getClassAverage)
router.get('/student/:studentId/export', protect, authorize('ADMIN', 'TEACHER'), gradeController.exportStudentGrades)

module.exports = router
