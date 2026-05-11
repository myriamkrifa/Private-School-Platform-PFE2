const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middlewares/auth.middleware')
const { listAuditLogs } = require('../controllers/audit.controller')

router.get('/', protect, authorize('ADMIN'), listAuditLogs)

module.exports = router
