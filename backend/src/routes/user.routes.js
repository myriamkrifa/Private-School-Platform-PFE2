const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middlewares/auth.middleware')
const {
	listUsers,
	approveUser,
	updateUserRole,
	provisionStudentWithParent,
	provisionTeacher
} = require('../controllers/user.controller')

router.get('/', protect, authorize('ADMIN'), listUsers)
router.post('/provision/student', protect, authorize('ADMIN'), provisionStudentWithParent)
router.post('/provision/teacher', protect, authorize('ADMIN'), provisionTeacher)
router.patch('/:id/approve', protect, authorize('ADMIN'), approveUser)
router.patch('/:id/role', protect, authorize('ADMIN'), updateUserRole)

module.exports = router
