import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../services/auth.service'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  const clearSession = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const savedToken = localStorage.getItem('token')
      if (!savedToken) {
        clearSession()
        if (!cancelled) setLoading(false)
        return
      }

      setToken(savedToken)

      try {
        const res = await getMe()
        if (cancelled) return
        const freshUser = res.data?.user
        if (freshUser) {
          setUser(freshUser)
          localStorage.setItem('user', JSON.stringify(freshUser))
        }
      } catch (error) {
        const status = error.response?.status
        if (status === 401 || status === 403) {
          if (!cancelled) clearSession()
        } else {
          const savedUser = localStorage.getItem('user')
          if (savedUser && !cancelled) {
            try {
              setUser(JSON.parse(savedUser))
            } catch {
              clearSession()
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  const login = (userData, authToken) => {
    setUser(userData)
    setToken(authToken)
    localStorage.setItem('token', authToken)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const updateUser = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const logout = () => {
    clearSession()
  }

  const isAuthenticated = !!token

  return (
    <AuthContext.Provider value={{ user, token, login, updateUser, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
