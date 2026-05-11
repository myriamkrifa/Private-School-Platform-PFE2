const express = require('express')
const router = express.Router()
const classController = require('../controllers/class.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, authorize('ADMIN', 'TEACHER', 'STUDENT'), classController.getAllClasses)
router.get('/:id', protect, authorize('ADMIN', 'TEACHER', 'STUDENT'), classController.getClassById)
router.post('/', protect, authorize('ADMIN'), classController.createClass)
router.put('/:id', protect, authorize('ADMIN'), classController.updateClass)
router.post('/:id/students', protect, authorize('ADMIN'), classController.addStudentToClass)
router.delete('/:id/students/:studentId', protect, authorize('ADMIN'), classController.removeStudentFromClass)
router.post('/:id/teachers', protect, authorize('ADMIN'), classController.addTeacherToClass)
router.delete('/:id/teachers/:teacherId', protect, authorize('ADMIN'), classController.removeTeacherFromClass)
router.delete('/:id', protect, authorize('ADMIN'), classController.deleteClass)

module.exports = router
