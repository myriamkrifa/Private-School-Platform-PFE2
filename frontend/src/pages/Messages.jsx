import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getInboxMessages,
  getMessageContacts,
  getSentMessages,
  markMessageAsRead,
  sendMessage
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

const initialForm = { recipientId: '', subject: '', content: '' }

export default function Messages() {
  const { user } = useAuth()
  const [tab, setTab] = useState('inbox')
  const [inbox, setInbox] = useState([])
  const [sent, setSent] = useState([])
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const recipientCandidates = contacts

  const refresh = async () => {
    try {
      const [inboxRes, sentRes] = await Promise.all([getInboxMessages(), getSentMessages()])
      setInbox(inboxRes.data?.data || [])
      setSent(sentRes.data?.data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load messages.')
    }
  }

  useEffect(() => {
    refresh()
    if (user?.role) {
      getMessageContacts().then((response) => setContacts(response.data?.data || [])).catch(() => {})
    }
  }, [user?.role])

  const handleSend = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!form.recipientId || !form.content.trim()) {
      setError('Please select a recipient and write a message.')
      return
    }
    setBusy(true)
    try {
      await sendMessage({
        recipientId: Number(form.recipientId),
        subject: form.subject || null,
        content: form.content
      })
      setForm(initialForm)
      setSuccess('Message sent.')
      await refresh()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message.')
    } finally {
      setBusy(false)
    }
  }

  const handleMarkRead = async (id) => {
    try {
      await markMessageAsRead(id)
      await refresh()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update message.')
    }
  }

  return (
    <DashboardShell title="Messages" subtitle="Communicate with teachers and parents.">
      <div className="space-y-4">
        <section className="page-card">
          <form onSubmit={handleSend} className="page-card">
            <h3>New Message</h3>
            <select
              className="form-input"
              value={form.recipientId}
              onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
            >
              <option value="">Select recipient</option>
              {recipientCandidates.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.name} ({recipient.role})
                </option>
              ))}
            </select>
            <input
              className="form-input"
              placeholder="Subject (optional)"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <textarea
              className="form-input"
              rows={3}
              placeholder="Write your message…"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send'}
            </button>
            {error ? <p className="field-error">{error}</p> : null}
            {success ? <p style={{ color: 'var(--success)' }}>{success}</p> : null}
          </form>
        </section>

        <section className="page-card">
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              className={`btn ${tab === 'inbox' ? 'btn-primary' : ''}`}
              onClick={() => setTab('inbox')}
            >
              Inbox ({inbox.length})
            </button>
            <button
              type="button"
              className={`btn ${tab === 'sent' ? 'btn-primary' : ''}`}
              onClick={() => setTab('sent')}
            >
              Sent ({sent.length})
            </button>
          </div>

          <div className="page-table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tab === 'inbox' ? 'From' : 'To'}</th>
                  <th>Role</th>
                  <th>Subject</th>
                  <th>Message</th>
                  <th>Date</th>
                  {tab === 'inbox' ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {(tab === 'inbox' ? inbox : sent).length === 0 ? (
                  <tr>
                    <td colSpan={tab === 'inbox' ? 6 : 5}>
                      {tab === 'inbox' ? 'Inbox is empty.' : 'No sent messages yet.'}
                    </td>
                  </tr>
                ) : (tab === 'inbox' ? inbox : sent).map((message) => {
                  const counterpart = tab === 'inbox' ? message.sender : message.recipient
                  return (
                    <tr key={message.id} className={message.isRead ? '' : 'font-medium'}>
                      <td>{counterpart?.name || '-'}</td>
                      <td>{counterpart?.role || '-'}</td>
                      <td>{message.subject || '-'}</td>
                      <td>{message.content}</td>
                      <td>{new Date(message.createdAt).toLocaleString()}</td>
                      {tab === 'inbox' ? (
                        <td>
                          {message.isRead ? (
                            <span className="text-xs text-emerald-700">Read</span>
                          ) : (
                            <button className="btn" type="button" onClick={() => handleMarkRead(message.id)}>
                              Mark as read
                            </button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
