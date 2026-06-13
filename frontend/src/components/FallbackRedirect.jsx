import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function FallbackRedirect() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div
          className="spinner"
          style={{ borderColor: 'rgba(108,99,255,0.3)', borderTopColor: 'var(--primary)' }}
        />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/login" replace state={{ message: 'Page not found. Please sign in again.' }} />
}
