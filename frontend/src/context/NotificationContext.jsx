import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { getUnreadNotificationCount } from '../services/auth.service'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    try {
      const res = await getUnreadNotificationCount()
      setUnreadCount(res.data?.data?.count ?? 0)
    } catch {
      setUnreadCount(0)
    }
  }, [user])

  useEffect(() => {
    refreshUnreadCount()
    const intervalId = setInterval(refreshUnreadCount, 20000)
    return () => clearInterval(intervalId)
  }, [refreshUnreadCount])

  useEffect(() => {
    const onFocus = () => refreshUnreadCount()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshUnreadCount])

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
