const {
  publishTimetable,
  getMyPublishedTimetable
} = require('../services/timetablePublish.service')

exports.publishTimetable = async (req, res) => {
  try {
    const reportId = Number.parseInt(req.params.reportId, 10)
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ message: 'Invalid timetable report id.' })
    }

    const result = await publishTimetable({
      reportId,
      publisherId: req.user.id
    })

    return res.json({
      success: true,
      message: 'Timetable accepted and sent to students, parents, and teachers.',
      data: result
    })
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || 'Error publishing timetable.',
      error: error.message
    })
  }
}

exports.getMyTimetable = async (req, res) => {
  try {
    const timetable = await getMyPublishedTimetable(req.user.id)
    return res.json({ success: true, data: timetable })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading timetable.', error: error.message })
  }
}
