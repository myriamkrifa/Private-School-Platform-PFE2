const express = require('express')
const router = express.Router()
const controller = require('../controllers/subject.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), controller.listSubjects)
router.get('/:id', protect, authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), controller.getSubjectById)
router.post('/', protect, authorize('ADMIN'), controller.createSubject)
router.put('/:id', protect, authorize('ADMIN'), controller.updateSubject)
router.delete('/:id', protect, authorize('ADMIN'), controller.deleteSubject)

module.exports = router
