const express = require('express')
const router = express.Router()
const controller = require('../controllers/teacherWork.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/classes', protect, authorize('TEACHER'), controller.getMyClasses)
router.get('/classes/:classId/students', protect, authorize('TEACHER'), controller.getClassStudents)
router.get('/classes/:classId/subjects', protect, authorize('TEACHER'), controller.getClassSubjects)

module.exports = router
