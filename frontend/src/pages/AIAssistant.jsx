import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  FileText,
  Loader2,
  MessageSquare,
  Plus
} from 'lucide-react'
import DashboardShell from '../components/DashboardShell'
import ReportContent from '../components/ReportContent'
import { DeleteIconButton } from '../components/TableIconButtons'
import { useAuth } from '../context/AuthContext'
import { getFallbackCapabilities } from '../config/aiAssistantConfig'
import API from '../services/apiClient'
import {
  deleteAiSession,
  deleteAiReport,
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

export default function AIAssistant() {
  const { user } = useAuth()
  const [capabilities, setCapabilities] = useState(() =>
    getFallbackCapabilities(user?.role || 'STUDENT')
  )
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
  const [showPromptMenu, setShowPromptMenu] = useState(false)
  const chatMessagesRef = useRef(null)
  const promptMenuRef = useRef(null)

  const isChatIdle = messages.length === 0 && !loadingChat
  const greetingName = user?.name?.trim().split(/\s+/)[0] || 'there'

  const sourceLabel = (source) => {
    if (source === 'school') return 'School AI'
    if (source === 'general') return 'General AI'
    if (source === 'mixed') return 'School + General'
    return null
  }

  const scrollToBottom = () => {
    const container = chatMessagesRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
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
  const reportOptions = (capabilities.reports || []).filter(
    (option) => option.type !== 'TIMETABLE_STUDENTS' && option.type !== 'TIMETABLE_TEACHERS'
  )
  const showReports = reportOptions.length > 0

  useEffect(() => {
    if (messages.length === 0 && !loadingChat) return
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

  const handleDeleteReport = async (reportId) => {
    try {
      await deleteAiReport(reportId)
      if (activeReport?.id === reportId) setActiveReport(null)
      await loadReports()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete report.')
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
      ) : null}

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
                      <DeleteIconButton
                        label="Delete conversation"
                        className="ai-session-delete"
                        onClick={() => handleDeleteSession(session.id)}
                      />
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
                  <div
                    key={report.id}
                    className={`ai-report-item${activeReport?.id === report.id ? ' is-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="ai-report-item-main"
                      onClick={() => openReport(report.id)}
                    >
                      <span className="ai-report-item-title">{report.title}</span>
                      <span className="ai-session-meta">{formatDateTime(report.createdAt)}</span>
                    </button>
                    <DeleteIconButton
                      label="Delete report"
                      className="ai-session-delete"
                      onClick={() => handleDeleteReport(report.id)}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </aside>

        <main className="ai-main">
          {panel === 'chat' ? (
            <div
              className={`ai-chat-panel page-card${isChatIdle ? ' ai-chat-panel--idle' : ''}`}
            >
              <div className="ai-chat-messages" ref={chatMessagesRef}>
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
              </div>

              <div className="ai-composer-wrap" ref={promptMenuRef}>
                {isChatIdle ? (
                  <h2 className="ai-chat-greeting">Here we go, {greetingName}</h2>
                ) : null}
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
                    placeholder="Ask a question (press Enter to send)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loadingChat || !apiOnline}
                    autoComplete="off"
                  />
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
                  <ReportContent text={activeReport.content} reportType={activeReport.type} />
                </section>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </DashboardShell>
  )
}
