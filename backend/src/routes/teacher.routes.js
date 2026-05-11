const express = require('express')
const router = express.Router()
const teacherController = require('../controllers/teacher.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, authorize('ADMIN', 'TEACHER'), teacherController.getAllTeachers)
router.get('/:id', protect, authorize('ADMIN', 'TEACHER'), teacherController.getTeacherById)
router.post('/', protect, authorize('ADMIN'), teacherController.createTeacher)
router.delete('/:id', protect, authorize('ADMIN'), teacherController.deleteTeacher)

module.exports = router
