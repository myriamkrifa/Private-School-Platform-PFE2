const express = require('express')
const router = express.Router()
const assignmentController = require('../controllers/assignment.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.post('/', protect, authorize('ADMIN', 'TEACHER'), assignmentController.createAssignment)
router.get('/course/:courseId', protect, authorize('ADMIN', 'TEACHER', 'STUDENT'), assignmentController.getCourseAssignments)
router.post('/:assignmentId/submissions', protect, authorize('STUDENT'), assignmentController.submitAssignment)
router.get('/:assignmentId/submissions', protect, authorize('ADMIN', 'TEACHER'), assignmentController.getAssignmentSubmissions)

module.exports = router
