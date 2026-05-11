import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registerUser } from '../services/auth.service'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
    setFieldErrors({ ...fieldErrors, [e.target.name]: '' })
  }

  const validate = () => {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Full name is required'
    if (!form.email.trim()) errors.email = 'Email is required'
    if (!form.role) errors.role = 'Please select a role'
    if (form.password.length < 6) errors.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword)
      errors.confirmPassword = 'Passwords do not match'
    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setLoading(true)
    try {
      const { confirmPassword, ...payload } = form
      const res = await registerUser(payload)
      login(res.data.user, res.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">

      {/* ── Left Banner ── */}
      <div className="auth-banner">
        <div className="banner-icon">✨</div>
        <h2 className="banner-title">Join EduManage Today</h2>
        <p className="banner-subtitle">
          Create your account and start managing your academic journey with clarity and ease.
          Select your role to get the right experience from the first login.
        </p>
        <div className="banner-stats">
          <div className="stat-item">
            <div className="stat-number">500+</div>
            <div className="stat-label">Students</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">100%</div>
            <div className="stat-label">Secure</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">Free</div>
            <div className="stat-label">Access</div>
          </div>
        </div>
      </div>

      {/* ── Right Form ── */}
      <div className="auth-form-side">
        <div className="auth-card">

          <div className="auth-header">
            <span className="auth-label">Create Account</span>
            <h1>Register your account</h1>
            <p>Fill in your details to get started</p>
          </div>

          {/* Info note */}
          <div className="alert alert-info" style={{
            background: 'rgba(108,99,255,0.06)',
            border: '1px solid rgba(108,99,255,0.2)',
            color: 'var(--primary)',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <span>ℹ️</span>
            Please select whether you are registering as an admin, student, teacher, or parent.
          </div>

          {error && (
            <div className="alert alert-error">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name</label>
              <div className="input-wrapper">
                <input
                  id="name"
                  className={`form-input ${fieldErrors.name ? 'has-error' : ''}`}
                  type="text"
                  name="name"
                  placeholder="e.g. Amina Benali"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                />
                <span className="input-icon">👤</span>
              </div>
              {fieldErrors.name && <p className="field-error">⚠ {fieldErrors.name}</p>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email Address</label>
              <div className="input-wrapper">
                <input
                  id="reg-email"
                  className={`form-input ${fieldErrors.email ? 'has-error' : ''}`}
                  type="email"
                  name="email"
                  placeholder="you@school.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
                <span className="input-icon">✉</span>
              </div>
              {fieldErrors.email && <p className="field-error">⚠ {fieldErrors.email}</p>}
            </div>

            {/* Role */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-role">Register As</label>
              <div className="input-wrapper">
                <select
                  id="reg-role"
                  className={`form-input ${fieldErrors.role ? 'has-error' : ''}`}
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                >
                  <option value="">Select your role</option>
                  <option value="STUDENT">Student</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="PARENT">Parent</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {fieldErrors.role && <p className="field-error">⚠ {fieldErrors.role}</p>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <div className="input-wrapper">
                <input
                  id="reg-password"
                  className={`form-input ${fieldErrors.password ? 'has-error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <span className="input-icon">🔒</span>
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {fieldErrors.password && <p className="field-error">⚠ {fieldErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <input
                  id="confirmPassword"
                  className={`form-input ${fieldErrors.confirmPassword ? 'has-error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <span className="input-icon">🔑</span>
              </div>
              {fieldErrors.confirmPassword && <p className="field-error">⚠ {fieldErrors.confirmPassword}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="register-submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? <span className="spinner"></span> : null}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

          </form>

          <div className="auth-footer">
            Already have an account?{' '}
            <Link to="/login">Sign in →</Link>
          </div>

        </div>
      </div>

    </div>
  )
}
