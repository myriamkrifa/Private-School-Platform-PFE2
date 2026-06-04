const { createChatCompletion: openAiComplete, isOpenAiConfigured } = require('./openai.service')

let geminiApiKey = process.env.GEMINI_API_KEY || ''

const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest'
]

function getGeminiModelsToTry() {
  const preferred = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim()
  return [...new Set([preferred, ...GEMINI_MODEL_FALLBACKS])]
}

function getDefaultGeminiModel() {
  return getGeminiModelsToTry()[0]
}
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

let ollamaAvailable = null
let ollamaCheckedAt = 0
const OLLAMA_CACHE_MS = 60_000

function isGeminiConfigured() {
  return Boolean(geminiApiKey && geminiApiKey.trim().length > 0)
}

function isValidGeminiKeyFormat(key) {
  const k = String(key || '').trim()
  // Google AI Studio: legacy AIzaSy… or newer AQ.… keys (both are valid)
  return k.startsWith('AIza') || k.startsWith('AQ')
}

function mapGeminiErrorMessage(message) {
  const msg = String(message || '')
  if (/blocked/i.test(msg)) {
    return 'Gemini API is blocked for your account or region. Ollama (local) will be used if running, or try a new key from https://aistudio.google.com/apikey.'
  }
  if (/denied access/i.test(msg)) {
    return 'Gemini denied this key. Create a key at https://aistudio.google.com/apikey (AIza… or AQ.… format).'
  }
  if (/API key not valid|invalid.*api.*key|401|403/i.test(msg)) {
    return 'Gemini rejected this API key. Create a fresh key at https://aistudio.google.com/apikey.'
  }
  return msg
}

let llmVerifyCache = { ok: null, error: null, provider: null, checkedAt: 0 }
const VERIFY_CACHE_MS = 90_000

async function verifyLlmWorks() {
  const now = Date.now()
  if (llmVerifyCache.checkedAt && now - llmVerifyCache.checkedAt < VERIFY_CACHE_MS) {
    return llmVerifyCache
  }

  if (!isOpenAiConfigured() && !isGeminiConfigured()) {
    if (await checkOllamaAvailable()) {
      try {
        await ollamaChatCompletion([{ role: 'user', content: 'Say OK' }])
        llmVerifyCache = { ok: true, error: null, provider: 'ollama', checkedAt: now }
        return llmVerifyCache
      } catch (error) {
        llmVerifyCache = { ok: false, error: error.message, provider: null, checkedAt: now }
        return llmVerifyCache
      }
    }
    llmVerifyCache = { ok: false, error: null, provider: null, checkedAt: now }
    return llmVerifyCache
  }

  if (isGeminiConfigured() && !isValidGeminiKeyFormat(geminiApiKey)) {
    llmVerifyCache = {
      ok: false,
      error:
        'API key format is not recognized. Paste a key from https://aistudio.google.com/apikey (starts with AIza or AQ).',
      provider: 'gemini',
      checkedAt: now
    }
    return llmVerifyCache
  }

  try {
    await testLlmConnection()
    const provider = await getActiveProvider()
    llmVerifyCache = { ok: true, error: null, provider, checkedAt: now }
  } catch (error) {
    if (await tryOllamaAfterLlmFailure(error)) {
      llmVerifyCache = { ok: true, error: null, provider: 'ollama', checkedAt: now }
      return llmVerifyCache
    }
    llmVerifyCache = {
      ok: false,
      error: mapGeminiErrorMessage(error.message),
      provider: isGeminiConfigured() ? 'gemini' : isOpenAiConfigured() ? 'openai' : null,
      checkedAt: now
    }
  }
  return llmVerifyCache
}

function isLlmRecoverableError(error) {
  const msg = String(error?.message || '')
  return /denied access|blocked|not valid|invalid.*key|401|403|not found for API|quota|billing/i.test(msg)
}

async function tryOllamaAfterLlmFailure(error) {
  if (!isLlmRecoverableError(error)) return false
  if (!(await checkOllamaAvailable())) return false
  try {
    await ollamaChatCompletion([{ role: 'user', content: 'Say OK' }])
    return true
  } catch {
    return false
  }
}

function setGeminiApiKey(key) {
  geminiApiKey = String(key || '').trim()
  process.env.GEMINI_API_KEY = geminiApiKey
}

async function checkOllamaAvailable() {
  const now = Date.now()
  if (ollamaAvailable !== null && now - ollamaCheckedAt < OLLAMA_CACHE_MS) {
    return ollamaAvailable
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)
    ollamaAvailable = res.ok
  } catch {
    ollamaAvailable = false
  }
  ollamaCheckedAt = now
  return ollamaAvailable
}

function isOllamaConfigured() {
  return ollamaAvailable === true
}

async function isLlmConfigured() {
  if (isOpenAiConfigured() || isGeminiConfigured()) return true
  return checkOllamaAvailable()
}

async function getActiveProvider() {
  const now = Date.now()
  if (llmVerifyCache.ok && llmVerifyCache.provider && now - llmVerifyCache.checkedAt < VERIFY_CACHE_MS) {
    return llmVerifyCache.provider
  }
  if (isOpenAiConfigured()) return 'openai'
  if (isGeminiConfigured()) return 'gemini'
  if (await checkOllamaAvailable()) return 'ollama'
  return null
}

function messagesToGeminiPayload(messages) {
  let systemText = ''
  const contents = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + msg.content
      continue
    }
    const role = msg.role === 'assistant' ? 'model' : 'user'
    const last = contents[contents.length - 1]
    if (last && last.role === role) {
      last.parts[0].text += `\n\n${msg.content}`
    } else {
      contents.push({ role, parts: [{ text: msg.content }] })
    }
  }

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] })
  }

  const body = {
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048
    }
  }

  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] }
  }

  return body
}

function messagesToOllama(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
    content: m.content
  }))
}

async function geminiRequestWithModel(model, messages) {
  const apiKey = geminiApiKey.trim()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(messagesToGeminiPayload(messages))
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const raw =
      payload?.error?.message ||
      `Gemini request failed with status ${response.status}.`
    const err = new Error(mapGeminiErrorMessage(raw))
    err.code = 'LLM_API_ERROR'
    err.status = response.status
    throw err
  }

  const parts = payload?.candidates?.[0]?.content?.parts
  const text = parts?.map((p) => p.text).filter(Boolean).join('\n')?.trim()

  if (!text) {
    const err = new Error('Gemini returned an empty response.')
    err.code = 'LLM_EMPTY_RESPONSE'
    throw err
  }

  return text
}

async function geminiChatCompletion(messages) {
  if (!isGeminiConfigured()) {
    const err = new Error('Gemini API key is not configured.')
    err.code = 'LLM_NOT_CONFIGURED'
    throw err
  }

  const models = getGeminiModelsToTry()
  let lastError = null

  for (const model of models) {
    try {
      return await geminiRequestWithModel(model, messages)
    } catch (error) {
      lastError = error
      const msg = String(error.message || '')
      const retryable = /not found|not supported|404/i.test(msg)
      if (!retryable) throw error
    }
  }

  throw lastError || new Error('No working Gemini model found.')
}

async function ollamaChatCompletion(messages) {
  const ok = await checkOllamaAvailable()
  if (!ok) {
    const err = new Error('Ollama is not running. Start Ollama or add GEMINI_API_KEY.')
    err.code = 'LLM_NOT_CONFIGURED'
    throw err
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: messagesToOllama(messages),
      stream: false
    })
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const err = new Error(payload?.error || `Ollama request failed (${response.status}).`)
    err.code = 'LLM_API_ERROR'
    err.status = response.status
    throw err
  }

  const text = payload?.message?.content?.trim()
  if (!text) {
    const err = new Error('Ollama returned an empty response.')
    err.code = 'LLM_EMPTY_RESPONSE'
    throw err
  }

  return text
}

/**
 * @param {Array<{ role: string, content: string }>} messages
 */
async function createChatCompletion(messages) {
  if (isOpenAiConfigured()) {
    return openAiComplete(messages)
  }
  if (isGeminiConfigured()) {
    try {
      return await geminiChatCompletion(messages)
    } catch (error) {
      if (await tryOllamaAfterLlmFailure(error)) {
        return ollamaChatCompletion(messages)
      }
      throw error
    }
  }
  if (await checkOllamaAvailable()) {
    return ollamaChatCompletion(messages)
  }

  const err = new Error(
    'No AI configured. Add GEMINI_API_KEY in the app setup below, or install Ollama locally.'
  )
  err.code = 'LLM_NOT_CONFIGURED'
  throw err
}

async function testLlmConnection() {
  const reply = await createChatCompletion([
    { role: 'user', content: 'Reply with exactly: OK' }
  ])
  return { ok: true, provider: await getActiveProvider(), preview: reply.slice(0, 80) }
}

module.exports = {
  createChatCompletion,
  isLlmConfigured,
  isOpenAiConfigured,
  isGeminiConfigured,
  isValidGeminiKeyFormat,
  isOllamaConfigured,
  checkOllamaAvailable,
  getActiveProvider,
  setGeminiApiKey,
  testLlmConnection,
  verifyLlmWorks,
  isLlmRecoverableError,
  mapGeminiErrorMessage,
  getDefaultGeminiModel,
  getGeminiModelsToTry,
  OLLAMA_MODEL
}
