const express = require('express')
const router = express.Router()
const courseController = require('../controllers/course.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, authorize('ADMIN', 'TEACHER', 'STUDENT'), courseController.getAllCourses)
router.post('/', protect, authorize('ADMIN', 'TEACHER'), courseController.createCourse)
router.get('/materials', protect, authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), courseController.listCourseMaterials)
router.get('/:courseId/materials', protect, authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), courseController.getCourseMaterials)
router.post('/:courseId/materials', protect, authorize('ADMIN', 'TEACHER'), courseController.addCourseMaterial)
router.delete('/materials/:id', protect, authorize('ADMIN', 'TEACHER'), courseController.deleteCourseMaterial)

module.exports = router
