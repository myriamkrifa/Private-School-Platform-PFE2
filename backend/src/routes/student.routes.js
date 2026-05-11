const express = require('express')
const router = express.Router()
const studentController = require('../controllers/student.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/me/children', protect, authorize('PARENT'), studentController.getMyChildren)
router.get('/', protect, authorize('ADMIN', 'TEACHER'), studentController.getAllStudents)
router.get('/:id', protect, authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), studentController.getStudentById)
router.get('/:id/progress', protect, authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), studentController.getStudentProgress)
router.post('/', protect, authorize('ADMIN'), studentController.createStudent)
router.post('/:id/parents', protect, authorize('ADMIN', 'TEACHER'), studentController.linkParentToStudent)
router.delete('/:id', protect, authorize('ADMIN'), studentController.deleteStudent)

module.exports = router
