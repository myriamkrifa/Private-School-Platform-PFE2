const express = require('express')
const router = express.Router()
const parentController = require('../controllers/parent.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, authorize('ADMIN'), parentController.getAllParents)
router.get('/:id', protect, authorize('ADMIN'), parentController.getParentById)
router.put('/:id', protect, authorize('ADMIN'), parentController.updateParent)
router.post('/:id/reset-password', protect, authorize('ADMIN'), parentController.resetParentPassword)
router.delete('/:id', protect, authorize('ADMIN'), parentController.deleteParent)

module.exports = router
