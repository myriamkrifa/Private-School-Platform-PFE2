const express = require('express')
const router = express.Router()
const aiController = require('../controllers/ai.controller')
const { protect } = require('../middlewares/auth.middleware')

router.use(protect)

router.get('/capabilities', aiController.getCapabilities)
router.get('/status', aiController.getStatus)
router.post('/configure', aiController.configureLlm)
router.get('/dashboard-stats', aiController.getDashboardStats)

router.get('/sessions', aiController.listSessions)
router.get('/sessions/:id', aiController.getSession)
router.delete('/sessions/:id', aiController.deleteSession)
router.post('/chat', aiController.sendMessage)

router.get('/reports', aiController.listReports)
router.get('/reports/:id', aiController.getReport)
router.delete('/reports/:id', aiController.deleteReport)
router.post('/reports/generate', aiController.generateReport)

module.exports = router
