import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { getMyNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'
import { useNotifications } from '../context/NotificationContext'

function formatNotificationType(type) {
  const labels = {
    MESSAGE: 'Message',
    GRADE: 'Grade',
    ABSENCE: 'Attendance',
    ANNOUNCEMENT: 'Announcement',
    ASSIGNMENT: 'Assignment',
    SYSTEM: 'System'
  }
  return labels[type] || type
}

export default function Notifications() {
  const { refreshUnreadCount } = useNotifications()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMyNotifications()
      setNotifications(res.data?.data || [])
      await refreshUnreadCount()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load notifications.')
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [refreshUnreadCount])

  useEffect(() => {
    load()
  }, [load])

  const markOne = async (id) => {
    try {
      await markNotificationAsRead(id)
      await load()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to mark notification.')
    }
  }

  const markAll = async () => {
    try {
      await markAllNotificationsAsRead()
      await load()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to mark all.')
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <DashboardShell title="Notifications" subtitle="Grades, absences, messages, and announcements.">
      <div className="notifications-page space-y-4">
        <section className="page-card notifications-toolbar">
          <div>
            <p className="notifications-summary">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                : 'All caught up'}
            </p>
          </div>
          {notifications.length > 0 && unreadCount > 0 ? (
            <button type="button" className="btn btn-primary btn-inline" onClick={markAll}>
              Mark all as read
            </button>
          ) : null}
        </section>

        {error ? <p className="field-error page-feedback">{error}</p> : null}

        {loading ? (
          <section className="page-card">
            <p className="text-muted">Loading notifications…</p>
          </section>
        ) : notifications.length === 0 ? (
          <section className="page-card notifications-empty">
            <Bell size={40} strokeWidth={1.5} aria-hidden />
            <h2>No notifications yet</h2>
            <p>When you receive messages, grades, or attendance updates, they will appear here.</p>
          </section>
        ) : (
          <section className="notifications-list">
            {notifications.map((n) => (
              <article
                key={n.id}
                className={`notification-card page-card${n.isRead ? '' : ' notification-card--unread'}`}
              >
                <div className="notification-card-header">
                  <span className={`notification-type notification-type--${String(n.type || 'system').toLowerCase()}`}>
                    {formatNotificationType(n.type)}
                  </span>
                  <time className="notification-date">{new Date(n.createdAt).toLocaleString()}</time>
                </div>
                {n.title ? <h3 className="notification-title">{n.title}</h3> : null}
                <p className="notification-message">{n.message}</p>
                {!n.isRead ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-inline notification-mark-read"
                    onClick={() => markOne(n.id)}
                  >
                    Mark as read
                  </button>
                ) : (
                  <span className="notification-read-label">Read</span>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </DashboardShell>
  )
}
