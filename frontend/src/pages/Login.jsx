import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AtSign, Lock } from 'lucide-react'
import { signInWithPopup } from 'firebase/auth'
import { useAuth } from '../context/AuthContext'
import { loginUser, firebaseGoogleLogin } from '../services/auth.service'
import { auth, googleProvider } from '../config/firebase'
import signinBgUrl from '../assets/signin-bg.png'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage] = useState(() => location.state?.message || '')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    try {
      const res = await loginUser(form)
      login(res.data.user, res.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const idToken = await result.user.getIdToken()
      const res = await firebaseGoogleLogin(idToken)
      login(res.data.user, res.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page-bg" aria-hidden="true">
        <img src={signinBgUrl} alt="" className="auth-page-bg__img" />
        <div className="auth-page-bg__shade" />
      </div>
      <div className="auth-layout">
        <div className="auth-banner">
        <div className="auth-panel">
          <div className="brand-lockup">
            <div className="brand-mark">PS</div>
            <div className="brand-copy">
              <p className="brand-name">Private School</p>
              <p className="brand-tag">Management Platform</p>
            </div>
          </div>
          <span className="auth-brand">PRIVATE SCHOOL PLATFORM</span>
          <h2 className="banner-title">Manage your school with clarity and confidence.</h2>
          <p className="banner-subtitle">
            Secure access for administrators, teachers, parents, and students in one professional workspace.
          </p>

          <p className="auth-note">Enterprise-grade privacy and role-based access control.</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-header-top">
              <h1>Welcome back</h1>
            </div>
            <p className="auth-header-sub">
              Sign in to access your Private School Management workspace.
            </p>
          </div>

          {infoMessage ? (
            <div className="alert alert-success mb-3">
              <span>✓</span> {infoMessage}
            </div>
          ) : null}

          {error && (
            <div className="alert alert-error">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <input
                  id="email"
                  className="form-input"
                  type="email"
                  name="email"
                  placeholder="admin@school.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
                <span className="input-icon input-icon-svg" aria-hidden>
                  <AtSign size={18} strokeWidth={2.25} />
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <span className="input-icon input-icon-svg" aria-hidden>
                  <Lock size={18} strokeWidth={2.25} />
                </span>
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="login-submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? <span className="spinner"></span> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="divider">or</div>

            <button
              type="button"
              className="btn btn-google"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <span className="google-icon" aria-hidden="true">G</span>
              {loading ? 'Please wait...' : 'Sign in with Google'}
            </button>
          </form>

          <div className="auth-footer">
            Contact your school administrator if you cannot access your account.
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
