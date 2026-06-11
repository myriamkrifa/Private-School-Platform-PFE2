import { useState } from 'react'
import FormModal from './FormModal'
import { changePasswordFirstLogin } from '../services/auth.service'
import { useAuth } from '../context/AuthContext'

export default function ParentFirstLoginModal() {
  const { user, updateUser } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await changePasswordFirstLogin({ newPassword })
      updateUser(res.data.user)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormModal
      accent="violet"
      title="Change your password"
      subtitle={`Welcome, ${user?.name || 'Parent'}. For security, set a new password before using the platform.`}
      closeDisabled
      footer={
        <button
          type="submit"
          form="parent-first-login-form"
          className="btn btn-primary w-full"
          disabled={loading}
        >
          {loading ? 'Saving…' : 'Save and continue'}
        </button>
      }
    >
      <form id="parent-first-login-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          You are signing in for the first time with a temporary password. Choose a personal password to continue.
        </p>

        <div>
          <span className="modal-field-label">New password</span>
          <input
            type="password"
            className="modal-field"
            placeholder="At least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </div>

        <div>
          <span className="modal-field-label">Confirm password</span>
          <input
            type="password"
            className="modal-field"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </form>
    </FormModal>
  )
}
