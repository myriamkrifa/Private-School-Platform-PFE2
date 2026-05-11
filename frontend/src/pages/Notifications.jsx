import { useEffect, useState } from 'react'
import { getMyNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')
  const load = async () => {
    try {
      const res = await getMyNotifications()
      setNotifications(res.data.data || [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load notifications.')
    }
  }

  useEffect(() => { load() }, [])

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

  return (
    <DashboardShell title="Notifications" subtitle="Grades, absences, messages, and announcements.">
      <div className="space-y-4">

          <section className="page-card">
            <button className="btn btn-primary" onClick={markAll}>Mark All As Read</button>
          </section>

          <section className="page-card page-table-card">
            <table className="data-table">
              <thead><tr><th>Type</th><th>Message</th><th>Read</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>{n.type}</td>
                    <td>{n.message}</td>
                    <td>{n.isRead ? 'Yes' : 'No'}</td>
                    <td>{new Date(n.createdAt).toLocaleString()}</td>
                    <td>{!n.isRead && <button className="btn btn-primary" onClick={() => markOne(n.id)}>Mark Read</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && <p className="field-error">{error}</p>}
          </section>
      </div>
    </DashboardShell>
  )
}
