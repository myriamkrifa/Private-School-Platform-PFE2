const express = require('express')
const router = express.Router()
const roomController = require('../controllers/room.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/', protect, authorize('ADMIN', 'TEACHER'), roomController.getAllRooms)
router.post('/schedule', protect, authorize('ADMIN', 'TEACHER'), roomController.generateMasterSchedule)
router.post('/', protect, authorize('ADMIN'), roomController.createRoom)
router.put('/:id', protect, authorize('ADMIN'), roomController.updateRoom)
router.delete('/:id', protect, authorize('ADMIN'), roomController.deleteRoom)
router.post('/:id/timetable', protect, authorize('ADMIN', 'TEACHER'), roomController.generateRoomTimetable)

module.exports = router
