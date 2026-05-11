const express = require('express')
const router = express.Router()
const controller = require('../controllers/teachingAssignment.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, authorize('ADMIN'), controller.getTeachingAssignments)
router.post('/', protect, authorize('ADMIN'), controller.createTeachingAssignment)
router.delete('/:id', protect, authorize('ADMIN'), controller.deleteTeachingAssignment)

module.exports = router
