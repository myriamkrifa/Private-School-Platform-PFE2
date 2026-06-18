const express = require('express')
const router = express.Router()
const timetableController = require('../controllers/timetable.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

router.get('/my', protect, authorize('STUDENT', 'PARENT', 'TEACHER'), timetableController.getMyTimetable)
router.post(
  '/publish/:reportId',
  protect,
  authorize('ADMIN'),
  timetableController.publishTimetable
)

module.exports = router
