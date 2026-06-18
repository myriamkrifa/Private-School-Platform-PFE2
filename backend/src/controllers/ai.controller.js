const prisma = require('../prisma')
const aiService = require('../services/ai.service')
const {
  isLlmConfigured,
  isOpenAiConfigured,
  isGeminiConfigured,
  getActiveProvider,
  setGeminiApiKey,
  testLlmConnection,
  verifyLlmWorks,
  isValidGeminiKeyFormat,
  checkOllamaAvailable
} = require('../services/llm.service')
const { updateEnvVariable } = require('../utils/envFile.util')

function providerLabel(provider) {
  if (provider === 'gemini') return 'Gemini'
  if (provider === 'openai') return 'OpenAI'
  if (provider === 'ollama') return 'Ollama (local)'
  return 'Local'
}

const parseId = (raw) => {
  const id = Number.parseInt(raw, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

exports.getCapabilities = async (req, res) => {
  const capabilities = aiService.getCapabilitiesForRole(req.user.role)
  return res.json({ success: true, data: capabilities })
}

exports.getStatus = async (req, res) => {
  const verify = await verifyLlmWorks()
  const llmReady = verify.ok
  const provider = verify.provider || (await getActiveProvider())
  const ollamaReady = await checkOllamaAvailable()
  const geminiKeySet = isGeminiConfigured()
  const capabilities = aiService.getCapabilitiesForRole(req.user.role)
  const dualMode = true

  let generalAiMode = 'local'
  let message = `${capabilities.title} is ready — School AI + built-in General AI (limited topics).`
  if (llmReady) {
    generalAiMode = provider || 'llm'
    message = `${capabilities.title} is ready — School AI + General AI (${providerLabel(provider)}).`
  } else if (geminiKeySet && verify.error) {
    message = `${capabilities.title} — Gemini key saved but not working. Fix the key below.`
  }

  return res.json({
    success: true,
    data: {
      configured: true,
      ready: true,
      role: req.user.role,
      llmConfigured: llmReady,
      llmWorking: llmReady,
      openAiConfigured: isOpenAiConfigured(),
      geminiConfigured: llmReady && provider === 'gemini',
      geminiKeySet,
      geminiKeyInvalid: geminiKeySet && !llmReady,
      llmError: verify.error || null,
      ollamaAvailable: ollamaReady,
      llmProvider: provider,
      dualMode,
      schoolAi: true,
      generalAi: true,
      generalAiMode,
      mode: 'dual',
      engine: llmReady ? `school-database+${provider}` : 'school-database+local+wikipedia',
      message,
      canConfigure: true,
      setupHint: llmReady
        ? null
        : 'Paste a free Gemini API key from Google AI Studio (AIza… or AQ.…).',
      capabilities
    }
  })
}

exports.configureLlm = async (req, res) => {
  const geminiApiKey = String(req.body?.geminiApiKey || '').trim()
  if (!geminiApiKey) {
    return res.status(400).json({ message: 'Gemini API key is required.' })
  }
  if (!isValidGeminiKeyFormat(geminiApiKey)) {
    return res.status(400).json({
      message:
        'Unrecognized API key. Create a key at Google AI Studio (https://aistudio.google.com/apikey) — keys start with AIza or AQ.'
    })
  }

  try {
    updateEnvVariable('GEMINI_API_KEY', geminiApiKey)
    updateEnvVariable('GEMINI_MODEL', 'gemini-2.5-flash')
    process.env.GEMINI_MODEL = 'gemini-2.5-flash'
    setGeminiApiKey(geminiApiKey)
    const test = await testLlmConnection()
    const provider = await getActiveProvider()

    return res.json({
      success: true,
      message: `Full AI enabled (${providerLabel(provider)}).`,
      data: {
        llmConfigured: true,
        llmProvider: provider,
        test
      }
    })
  } catch (error) {
    return res.status(502).json({
      message: error.message || 'Failed to configure AI. Check your API key.',
      error: error.message
    })
  }
}

exports.getDashboardStats = async (req, res) => {
  try {
    const data = await aiService.getDashboardStats(req.user.id)
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading AI dashboard stats.', error: error.message })
  }
}

exports.listSessions = async (req, res) => {
  try {
    const sessions = await prisma.aiChatSession.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true, createdAt: true }
        },
        _count: { select: { messages: true } }
      }
    })
    return res.json({ success: true, data: sessions })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading chat sessions.', error: error.message })
  }
}

exports.getSession = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) {
      return res.status(400).json({ message: 'Invalid session id.' })
    }

    const session = await prisma.aiChatSession.findFirst({
      where: { id, userId: req.user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    })

    if (!session) {
      return res.status(404).json({ message: 'Chat session not found.' })
    }

    return res.json({ success: true, data: session })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading chat session.', error: error.message })
  }
}

exports.deleteSession = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) {
      return res.status(400).json({ message: 'Invalid session id.' })
    }

    const existing = await prisma.aiChatSession.findFirst({
      where: { id, userId: req.user.id }
    })
    if (!existing) {
      return res.status(404).json({ message: 'Chat session not found.' })
    }

    await prisma.aiChatSession.delete({ where: { id } })
    return res.json({ success: true, message: 'Chat session deleted.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting chat session.', error: error.message })
  }
}

exports.sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body
    const parsedSessionId = sessionId ? parseId(sessionId) : null

    const result = await aiService.sendChatMessage({
      userId: req.user.id,
      userRole: req.user.role,
      sessionId: parsedSessionId,
      message
    })

    return res.json({
      success: true,
      data: {
        session: result.session,
        message: result.assistantMessage,
        meta: result.meta || null
      }
    })
  } catch (error) {
    const status = error.status || 500
    return res.status(status).json({ message: error.message || 'Error sending message.' })
  }
}

exports.listReports = async (req, res) => {
  try {
    const reports = await prisma.aiGeneratedReport.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, type: true, title: true, createdAt: true, publishedAt: true }
    })
    return res.json({ success: true, data: reports })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading reports.', error: error.message })
  }
}

exports.getReport = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) {
      return res.status(400).json({ message: 'Invalid report id.' })
    }

    const report = await prisma.aiGeneratedReport.findFirst({
      where: { id, userId: req.user.id }
    })

    if (!report) {
      return res.status(404).json({ message: 'Report not found.' })
    }

    return res.json({ success: true, data: report })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading report.', error: error.message })
  }
}

exports.generateReport = async (req, res) => {
  try {
    const { reportType } = req.body
    const report = await aiService.generateReport({
      userId: req.user.id,
      userRole: req.user.role,
      reportType
    })
    return res.status(201).json({ success: true, data: report })
  } catch (error) {
    const status = error.status || 500
    return res.status(status).json({ message: error.message || 'Error generating report.' })
  }
}

exports.deleteReport = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) {
      return res.status(400).json({ message: 'Invalid report id.' })
    }

    const existing = await prisma.aiGeneratedReport.findFirst({
      where: { id, userId: req.user.id }
    })
    if (!existing) {
      return res.status(404).json({ message: 'Report not found.' })
    }

    await prisma.aiGeneratedReport.delete({ where: { id } })
    return res.json({ success: true, message: 'Report deleted.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting report.', error: error.message })
  }
}
