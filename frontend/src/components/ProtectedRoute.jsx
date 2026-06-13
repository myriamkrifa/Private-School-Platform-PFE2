import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ParentFirstLoginModal from './ParentFirstLoginModal'

function parentNeedsPasswordChange(user) {
  if (user?.role !== 'PARENT') return false
  return user.isFirstLogin === true || user.mustChangePassword === true
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}>
        <div className="spinner" style={{ borderColor:'rgba(108,99,255,0.3)', borderTopColor:'var(--primary)' }}></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ message: 'Please sign in to continue.' }} />
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (parentNeedsPasswordChange(user)) {
    return (
      <div className="min-h-screen bg-slate-100">
        <ParentFirstLoginModal />
      </div>
    )
  }

  return children
}
