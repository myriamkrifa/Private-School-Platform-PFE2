/**
 * Free factual answers (Wikipedia + DuckDuckGo) when no LLM API key is set.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'about', 'what', 'whats', "what's",
  'how', 'why', 'when', 'where', 'who', 'which', 'tell', 'me', 'explain',
  'define', 'please', 'help', 'want', 'know', 'give', 'need', 'like'
])

const QUERY_ALIASES = {
  coding: 'computer programming',
  code: 'computer programming',
  programmer: 'computer programming',
  programing: 'computer programming',
  maths: 'mathematics',
  math: 'mathematics',
  'sky blue': 'why is the sky blue',
  'the sky blue': 'why is the sky blue'
}

function cleanTopic(term) {
  return String(term || '')
    .replace(/[?.!]+$/, '')
    .trim()
    .replace(/^(the|a|an)\s+/i, '')
}

function buildSearchTerms(message) {
  const raw = String(message || '').trim()
  const patterns = [
    /^(?:what is|what's|whats|what about|tell me about|explain|define|describe)\s+(?:an?\s+)?(.+)$/i,
    /^(?:how does|how do|how is|how are|how can|how to)\s+(.+)$/i,
    /^(?:why is|why are|why do|why does)\s+(.+)$/i,
    /^(?:who is|who was|who are|who were)\s+(.+)$/i,
    /^(?:can you explain|help me understand)\s+(.+)$/i
  ]

  for (const pattern of patterns) {
    const match = raw.match(pattern)
    if (match) return cleanTopic(match[1])
  }

  return cleanTopic(raw)
}

function buildSearchVariants(message) {
  const primary = buildSearchTerms(message)
  const variants = new Set()

  if (primary) {
    variants.add(primary)
    const alias = QUERY_ALIASES[primary.toLowerCase()]
    if (alias) variants.add(alias)
  }

  const words = String(message || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

  if (words.length >= 2) {
    variants.add(words.slice(0, 6).join(' '))
  }
  if (words.length >= 1) {
    variants.add(words.slice(0, 4).join(' '))
  }

  const trimmed = String(message || '').trim().slice(0, 80)
  if (trimmed.length >= 3) variants.add(trimmed)

  return [...variants].filter((v) => v && v.length >= 2).slice(0, 6)
}

async function fetchWikipediaSummary(searchTerm) {
  const term = String(searchTerm || '').trim()
  if (!term || term.length < 2) return null

  const normalized = term.toLowerCase()
  const query = QUERY_ALIASES[normalized] || term

  try {
    const searchUrl = new URL('https://en.wikipedia.org/w/api.php')
    searchUrl.searchParams.set('action', 'opensearch')
    searchUrl.searchParams.set('search', query)
    searchUrl.searchParams.set('limit', '1')
    searchUrl.searchParams.set('format', 'json')

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { 'User-Agent': 'EduManage-School-Platform/1.0' }
    })
    if (!searchRes.ok) return null

    const searchData = await searchRes.json()
    const title = searchData?.[1]?.[0]
    if (!title) return null

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    const summaryRes = await fetch(summaryUrl, {
      headers: { 'User-Agent': 'EduManage-School-Platform/1.0' }
    })
    if (!summaryRes.ok) return null

    const data = await summaryRes.json()
    const extract = data?.extract
    if (!extract || extract.length < 40) return null

    const readMore = data?.content_urls?.desktop?.page
    let text = `**${data.title}**\n\n${extract}`
    if (readMore) {
      text += `\n\n_Source: [Wikipedia](${readMore})_`
    }
    return text
  } catch {
    return null
  }
}

async function fetchDuckDuckGoSummary(searchTerm) {
  const term = String(searchTerm || '').trim()
  if (!term || term.length < 2) return null

  try {
    const url = new URL('https://api.duckduckgo.com/')
    url.searchParams.set('q', QUERY_ALIASES[term.toLowerCase()] || term)
    url.searchParams.set('format', 'json')
    url.searchParams.set('no_redirect', '1')
    url.searchParams.set('skip_disambig', '1')

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'EduManage-School-Platform/1.0' }
    })
    if (!res.ok) return null

    const data = await res.json()
    const text = data?.AbstractText
    if (!text || text.length < 40) return null

    const heading = data?.Heading || term
    let out = `**${heading}**\n\n${text}`
    if (data?.AbstractURL) {
      out += `\n\n_Source: [DuckDuckGo](${data.AbstractURL})_`
    }
    return out
  } catch {
    return null
  }
}

async function answerFromGeneralKnowledge(message) {
  const raw = String(message || '').trim()
  const variants = buildSearchVariants(message)

  const ddgFirst = /^(?:why|how|when|where|who)\b/i.test(raw)
  const searchOrder = ddgFirst
    ? [
        () => fetchDuckDuckGoSummary(raw),
        ...variants.map((t) => () => fetchDuckDuckGoSummary(t)),
        ...variants.map((t) => () => fetchWikipediaSummary(t))
      ]
    : [
        ...variants.map((t) => () => fetchWikipediaSummary(t)),
        () => fetchDuckDuckGoSummary(raw),
        ...variants.map((t) => () => fetchDuckDuckGoSummary(t))
      ]

  for (const fn of searchOrder) {
    const result = await fn()
    if (result) return result
  }

  return null
}

function buildHelpfulFallback(message) {
  const topic = buildSearchTerms(message) || 'that'
  return `I looked up **${topic}** but couldn't find a solid summary for this exact wording.

Try rephrasing, for example:
- "What is ${topic}"
- "Explain ${topic} simply"

**School questions** (grades, homework, attendance) use your EduManage database — ask directly.`
}

module.exports = {
  answerFromGeneralKnowledge,
  fetchWikipediaSummary,
  buildSearchTerms,
  buildHelpfulFallback
}
