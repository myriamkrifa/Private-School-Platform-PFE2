import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  Trash2
} from 'lucide-react'
import DashboardShell from '../components/DashboardShell'
import { useAuth } from '../context/AuthContext'
import { getFallbackCapabilities } from '../config/aiAssistantConfig'
import API from '../services/apiClient'
import {
  configureAiLlm,
  deleteAiSession,
  generateAiReport,
  getAiReport,
  getAiReports,
  getAiSession,
  getAiSessions,
  getAiStatus,
  sendAiMessage
} from '../services/ai.service'

function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function renderChatText(text) {
  const lines = String(text || '').split('\n')
  return lines.map((line, lineIndex) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
    return (
      <span key={lineIndex}>
        {lineIndex > 0 ? <br /> : null}
        {parts.map((part, i) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    )
  })
}

function ReportContent({ text }) {
  const paragraphs = String(text || '').split(/\n\n+/)
  return (
    <div className="ai-report-body">
      {paragraphs.map((block, index) => {
        const lines = block.split('\n')
        const isHeading = lines.length === 1 && (lines[0].endsWith(':') || /^#+\s/.test(lines[0]) || /^[A-Z][^.]{0,60}$/.test(lines[0]))
        if (isHeading) {
          return <h4 key={index} className="ai-report-heading">{lines[0].replace(/^#+\s*/, '')}</h4>
        }
        if (lines.some((l) => l.trim().startsWith('- ') || l.trim().startsWith('• '))) {
          return (
            <ul key={index} className="ai-report-list">
              {lines.filter((l) => l.trim()).map((line, i) => (
                <li key={i}>{line.replace(/^[-•]\s*/, '')}</li>
              ))}
            </ul>
          )
        }
        return <p key={index}>{block}</p>
      })}
    </div>
  )
}

export default function AIAssistant() {
  const { user } = useAuth()
  const [capabilities, setCapabilities] = useState(() =>
    getFallbackCapabilities(user?.role || 'STUDENT')
  )
  const [aiMode, setAiMode] = useState('local')
  const [apiOnline, setApiOnline] = useState(true)
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loadingChat, setLoadingChat] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [error, setError] = useState('')
  const [sessionsError, setSessionsError] = useState('')
  const [reports, setReports] = useState([])
  const [activeReport, setActiveReport] = useState(null)
  const [generatingReport, setGeneratingReport] = useState(null)
  const [panel, setPanel] = useState('chat')
  const [statusMessage, setStatusMessage] = useState('')
  const [setupHint, setSetupHint] = useState('')
  const [llmConfigured, setLlmConfigured] = useState(false)
  const [geminiConfigured, setGeminiConfigured] = useState(false)
  const [geminiKeyInvalid, setGeminiKeyInvalid] = useState(false)
  const [llmError, setLlmError] = useState('')
  const [canConfigure, setCanConfigure] = useState(true)
  const [ollamaAvailable, setOllamaAvailable] = useState(false)
  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [showPromptMenu, setShowPromptMenu] = useState(false)
  const chatEndRef = useRef(null)
  const promptMenuRef = useRef(null)

  const sourceLabel = (source) => {
    if (source === 'school') return 'School AI'
    if (source === 'general') return 'General AI'
    if (source === 'mixed') return 'School + General'
    return null
  }

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    setSessionsError('')
    try {
      const res = await getAiSessions()
      setSessions(res.data?.data || [])
    } catch (e) {
      if (!e.response) {
        setSessions([])
        return
      }
      const status = e.response?.status
      const serverMsg = e.response?.data?.message || e.response?.data?.error
      let message = serverMsg || 'Failed to load conversations.'
      if (status === 401) {
        message = 'Session expired. Please log out and log in again.'
      } else if (status === 403) {
        message = 'AI Assistant is only available to ADMIN users.'
      } else if (status === 404) {
        message = 'AI API not found. Restart the backend (npm run dev in backend).'
      } else if (status === 500 && String(serverMsg || e.message).includes('aiChatSession')) {
        message = 'Database client out of date. Stop the backend, run: npx prisma generate, then restart.'
      }
      setSessionsError(message)
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const loadReports = useCallback(async () => {
    try {
      const res = await getAiReports()
      setReports(res.data?.data || [])
    } catch {
      setReports([])
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        await API.get('/health')
        setApiOnline(true)
      } catch {
        setApiOnline(false)
        setSessionsError(
          'Backend is not running. Open a terminal in the backend folder and run: npm run dev'
        )
        return
      }

      try {
        const res = await getAiStatus()
        const data = res.data?.data || {}
        setLlmConfigured(Boolean(data.llmWorking ?? data.llmConfigured))
        setGeminiConfigured(Boolean(data.geminiConfigured))
        setGeminiKeyInvalid(Boolean(data.geminiKeyInvalid))
        setLlmError(data.llmError || '')
        setCanConfigure(data.canConfigure !== false)
        setOllamaAvailable(Boolean(data.ollamaAvailable))
        setAiMode(data.llmConfigured ? 'llm' : 'local')
        setStatusMessage(data.message || '')
        setSetupHint(data.setupHint || '')
        if (data.capabilities) {
          setCapabilities(data.capabilities)
        } else if (user?.role) {
          setCapabilities(getFallbackCapabilities(user.role))
        }
      } catch (e) {
        const status = e.response?.status
        if (status === 401) {
          setSessionsError('Session expired. Please log out and log in again.')
        } else if (status === 403) {
          setSessionsError('You do not have permission to use the AI Assistant.')
        }
        setAiMode('local')
      }

      loadSessions()
      loadReports()
    }

    init()
  }, [loadSessions, loadReports, user?.role])

  const suggestedPrompts = capabilities.prompts || []
  const reportOptions = capabilities.reports || []
  const showReports = reportOptions.length > 0

  useEffect(() => {
    scrollToBottom()
  }, [messages, loadingChat])

  const openSession = async (sessionId) => {
    setError('')
    setActiveSessionId(sessionId)
    setPanel('chat')
    try {
      const res = await getAiSession(sessionId)
      const sessionMessages = (res.data?.data?.messages || []).filter(
        (m) => m.role === 'USER' || m.role === 'ASSISTANT'
      )
      setMessages(sessionMessages)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load conversation.')
      setMessages([])
    }
  }

  const startNewChat = () => {
    setActiveSessionId(null)
    setMessages([])
    setInput('')
    setError('')
    setPanel('chat')
  }

  const sendText = async (text) => {
    const trimmed = String(text || '').trim()
    if (!trimmed || loadingChat || !apiOnline) return

    setInput('')
    setError('')
    setLoadingChat(true)

    const optimisticUser = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content: trimmed,
      createdAt: new Date().toISOString()
    }
    setMessages((prev) => [...prev, optimisticUser])

    try {
      const res = await sendAiMessage({
        message: trimmed,
        sessionId: activeSessionId || undefined
      })
      const { session, message: assistantMsg, meta } = res.data?.data || {}
      if (session?.id && !activeSessionId) {
        setActiveSessionId(session.id)
      }
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        { role: 'USER', content: trimmed, createdAt: optimisticUser.createdAt },
        { ...assistantMsg, meta: meta || null }
      ])
      await loadSessions()
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
      setInput(trimmed)
      setError(e.response?.data?.message || 'Failed to get AI response.')
    } finally {
      setLoadingChat(false)
    }
  }

  const handleSend = (e) => {
    e?.preventDefault()
    setShowPromptMenu(false)
    sendText(input)
  }

  const handlePromptPick = (prompt) => {
    setShowPromptMenu(false)
    sendText(prompt)
  }

  useEffect(() => {
    if (!showPromptMenu) return undefined
    const onDocClick = (ev) => {
      if (promptMenuRef.current && !promptMenuRef.current.contains(ev.target)) {
        setShowPromptMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showPromptMenu])

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteAiSession(sessionId)
      if (activeSessionId === sessionId) startNewChat()
      await loadSessions()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete conversation.')
    }
  }

  const handleGenerateReport = async (reportType) => {
    setGeneratingReport(reportType)
    setError('')
    setPanel('reports')
    try {
      const res = await generateAiReport(reportType)
      const report = res.data?.data
      setActiveReport(report)
      await loadReports()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to generate report.')
    } finally {
      setGeneratingReport(null)
    }
  }

  const handleSaveGeminiKey = async (e) => {
    e.preventDefault()
    const key = geminiKeyInput.trim()
    if (!key) {
      setSetupError('Paste your Gemini API key first.')
      return
    }
    setSavingKey(true)
    setSetupError('')
    try {
      const res = await configureAiLlm(key)
      setLlmConfigured(true)
      setGeminiConfigured(true)
      setGeminiKeyInput('')
      setStatusMessage(res.data?.message || 'Full AI enabled.')
      setAiMode('llm')
    } catch (err) {
      setSetupError(err.response?.data?.message || 'Failed to save API key.')
    } finally {
      setSavingKey(false)
    }
  }

  const renderApiKeySetup = (compact = false) => (
    <div className={compact ? 'ai-setup-inline' : 'page-card ai-config-warning ai-setup-card'}>
      <h3 className="ai-setup-title">Enable full AI — paste your Gemini API key</h3>
      <p className={compact ? 'text-muted' : ''}>
        Get a free key from{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>
        {ollamaAvailable && !compact ? ' · Local Ollama is also available' : ''}.
      </p>
      <form className="ai-setup-form" onSubmit={handleSaveGeminiKey}>
        <input
          type="password"
          className="form-input"
          placeholder="Paste your API key (AIza… or AQ.… from AI Studio)"
          value={geminiKeyInput}
          onChange={(e) => setGeminiKeyInput(e.target.value)}
          autoComplete="off"
          disabled={savingKey}
        />
        <button type="submit" className="btn btn-primary" disabled={savingKey || !geminiKeyInput.trim()}>
          {savingKey ? (
            <>
              <Loader2 size={16} className="ai-spinner" aria-hidden />
              Saving…
            </>
          ) : (
            'Enable full AI'
          )}
        </button>
      </form>
      {setupError ? <p className="field-error">{setupError}</p> : null}
      <p className="text-muted ai-setup-alt">
        Or edit <code>backend/.env</code> → <code>GEMINI_API_KEY=your-key</code> and restart the backend.
      </p>
    </div>
  )

  const openReport = async (reportId) => {
    setPanel('reports')
    setError('')
    try {
      const res = await getAiReport(reportId)
      setActiveReport(res.data?.data)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load report.')
    }
  }

  return (
    <DashboardShell
      title={capabilities.title || 'AI Assistant'}
      subtitle={capabilities.subtitle || 'Ask questions about your school data.'}
    >
      {!apiOnline ? (
        <div className="page-card ai-config-warning">
          <p>
            Cannot reach the server. In a terminal run <code>cd backend</code> then{' '}
            <code>npm run dev</code> (port 5000), then refresh this page.
          </p>
        </div>
      ) : geminiKeyInvalid && canConfigure ? (
        <>
          <div className="page-card ai-config-warning ai-setup-card">
            <p>
              <strong>Gemini key is not working.</strong> {llmError || statusMessage}
            </p>
          </div>
          {renderApiKeySetup()}
        </>
      ) : !geminiConfigured && canConfigure ? (
        renderApiKeySetup()
      ) : (
        <div className="page-card ai-config-success">
          <CheckCircle2 size={20} aria-hidden />
          <p>{statusMessage || 'AI Assistant is ready.'}</p>
        </div>
      )}

      {error ? <p className="field-error page-feedback">{error}</p> : null}
      {sessionsError ? <p className="field-error page-feedback">{sessionsError}</p> : null}

      <div className="ai-assistant-layout">
        <aside className="ai-sidebar page-card">
          <div className="ai-sidebar-header">
            <button type="button" className="btn btn-primary ai-new-chat-btn" onClick={startNewChat}>
              <Plus size={16} aria-hidden />
              New chat
            </button>
          </div>

          <div className="ai-sidebar-tabs">
            <button
              type="button"
              className={`ai-sidebar-tab${panel === 'chat' ? ' is-active' : ''}`}
              onClick={() => setPanel('chat')}
            >
              <MessageSquare size={14} aria-hidden />
              Chats
            </button>
            {showReports ? (
              <button
                type="button"
                className={`ai-sidebar-tab${panel === 'reports' ? ' is-active' : ''}`}
                onClick={() => setPanel('reports')}
              >
                <FileText size={14} aria-hidden />
                Reports
              </button>
            ) : null}
          </div>

          {panel === 'chat' ? (
            <div className="ai-session-list">
              {loadingSessions ? (
                <p className="text-muted ai-sidebar-muted">Loading…</p>
              ) : sessions.length === 0 ? (
                <p className="text-muted ai-sidebar-muted">No conversations yet.</p>
              ) : (
                sessions.map((session) => {
                  const preview = session.messages?.[0]?.content || 'Empty conversation'
                  return (
                    <div
                      key={session.id}
                      className={`ai-session-item${activeSessionId === session.id ? ' is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="ai-session-item-main"
                        onClick={() => openSession(session.id)}
                      >
                        <span className="ai-session-title">{session.title}</span>
                        <span className="ai-session-preview">{preview}</span>
                        <span className="ai-session-meta">
                          {session._count?.messages || 0} messages · {formatDateTime(session.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn-icon ai-session-delete"
                        title="Delete conversation"
                        aria-label="Delete conversation"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="ai-report-list-sidebar">
              {reports.length === 0 ? (
                <p className="text-muted ai-sidebar-muted">No reports generated yet.</p>
              ) : (
                reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    className={`ai-report-list-item${activeReport?.id === report.id ? ' is-active' : ''}`}
                    onClick={() => openReport(report.id)}
                  >
                    <span>{report.title}</span>
                    <span className="ai-session-meta">{formatDateTime(report.createdAt)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </aside>

        <main className="ai-main">
          {panel === 'chat' ? (
            <div
              className={`ai-chat-panel page-card${messages.length === 0 && !loadingChat ? ' ai-chat-panel--idle' : ''}`}
            >
              {!geminiConfigured && canConfigure && apiOnline && messages.length === 0 && !loadingChat
                ? renderApiKeySetup(true)
                : null}
              <div className="ai-chat-messages">
                {messages.map((msg, index) => (
                    <div
                      key={msg.id || `${msg.role}-${index}`}
                      className={`ai-message ai-message--${msg.role === 'USER' ? 'user' : 'assistant'}`}
                    >
                      <div className="ai-message-bubble">
                        {msg.role === 'ASSISTANT' ? (
                          <span className="ai-message-avatar" aria-hidden>
                            <Bot size={16} />
                          </span>
                        ) : null}
                        <div className="ai-message-content-wrap">
                          {msg.role === 'ASSISTANT' && msg.meta?.source ? (
                            <span className={`ai-source-badge ai-source-badge--${msg.meta.source}`}>
                              {sourceLabel(msg.meta.source)}
                            </span>
                          ) : null}
                          <div className="ai-message-content">{renderChatText(msg.content)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                {loadingChat ? (
                  <div className="ai-message ai-message--assistant">
                    <div className="ai-message-bubble ai-message-bubble--loading">
                      <Loader2 size={18} className="ai-spinner" aria-hidden />
                      <span>Thinking…</span>
                    </div>
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              <div className="ai-composer-wrap" ref={promptMenuRef}>
                {showPromptMenu && suggestedPrompts.length > 0 ? (
                  <div className="ai-composer-suggestions" role="menu">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        role="menuitem"
                        className="ai-composer-suggestion-item"
                        onClick={() => handlePromptPick(prompt)}
                        disabled={loadingChat || !apiOnline}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}
                <form className="ai-composer-pill" onSubmit={handleSend}>
                  <button
                    type="button"
                    className="ai-composer-icon-btn"
                    aria-label="Suggested questions"
                    aria-expanded={showPromptMenu}
                    disabled={!apiOnline}
                    onClick={() => setShowPromptMenu((v) => !v)}
                  >
                    <Plus size={20} aria-hidden />
                  </button>
                  <input
                    type="text"
                    className="ai-composer-field"
                    placeholder="Ask a question"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loadingChat || !apiOnline}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="ai-composer-icon-btn"
                    aria-label="Voice input (coming soon)"
                    disabled
                    title="Voice input coming soon"
                  >
                    <Mic size={20} aria-hidden />
                  </button>
                  <button
                    type="submit"
                    className="ai-composer-send"
                    aria-label="Send message"
                    disabled={loadingChat || !input.trim() || !apiOnline}
                  >
                    {loadingChat ? (
                      <Loader2 size={18} className="ai-spinner" aria-hidden />
                    ) : (
                      <AudioLines size={18} aria-hidden />
                    )}
                  </button>
                </form>
              </div>
            </div>
          ) : showReports ? (
            <div className="ai-reports-panel">
              <section className="page-card">
                <h2 className="section-heading">Generate reports</h2>
                <p className="text-muted ai-reports-intro">
                  Professional summaries based on your role and available school data.
                </p>
                <div className="ai-report-grid">
                  {reportOptions.map((option) => (
                    <div key={option.type} className="ai-report-card">
                      <h3>{option.label}</h3>
                      <p>{option.description}</p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={Boolean(generatingReport) || !apiOnline}
                        onClick={() => handleGenerateReport(option.type)}
                      >
                        {generatingReport === option.type ? (
                          <>
                            <Loader2 size={16} className="ai-spinner" aria-hidden />
                            Generating…
                          </>
                        ) : (
                          'Generate'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {activeReport ? (
                <section className="page-card ai-generated-report-card">
                  <div className="ai-report-card-header">
                    <FileText size={20} aria-hidden />
                    <div>
                      <h2 className="section-heading">{activeReport.title}</h2>
                      <p className="text-muted">{formatDateTime(activeReport.createdAt)}</p>
                    </div>
                  </div>
                  <ReportContent text={activeReport.content} />
                </section>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </DashboardShell>
  )
}
