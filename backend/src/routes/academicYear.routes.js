const express = require('express')
const router = express.Router()
const academicYearController = require('../controllers/academicYear.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, academicYearController.getAcademicYears)
router.post('/', protect, authorize('ADMIN'), academicYearController.createAcademicYear)
router.patch('/:id', protect, authorize('ADMIN'), academicYearController.updateAcademicYear)
router.delete('/:id', protect, authorize('ADMIN'), academicYearController.deleteAcademicYear)

module.exports = router
