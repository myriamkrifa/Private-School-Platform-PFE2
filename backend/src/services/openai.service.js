const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

function isOpenAiConfigured() {
  return Boolean(OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 0)
}

/**
 * @param {Array<{ role: string, content: string }>} messages
 */
async function createChatCompletion(messages) {
  if (!isOpenAiConfigured()) {
    const err = new Error('OpenAI API key is not configured. Set OPENAI_API_KEY in the server .env file.')
    err.code = 'OPENAI_NOT_CONFIGURED'
    throw err
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 2048
    })
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `OpenAI request failed with status ${response.status}.`
    const err = new Error(message)
    err.code = 'OPENAI_API_ERROR'
    err.status = response.status
    throw err
  }

  const content = payload?.choices?.[0]?.message?.content
  if (!content) {
    const err = new Error('OpenAI returned an empty response.')
    err.code = 'OPENAI_EMPTY_RESPONSE'
    throw err
  }

  return content.trim()
}

module.exports = { createChatCompletion, isOpenAiConfigured, OPENAI_MODEL }
