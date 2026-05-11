import { useEffect, useState } from 'react'
import { getAcademicYears, createAcademicYear } from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

export default function AcademicYears() {
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', isActive: false })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadYears = async () => {
    setLoading(true)
    try {
      const res = await getAcademicYears()
      setYears(res.data.data || [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load academic years.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadYears()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await createAcademicYear(form)
      setForm({ name: '', startDate: '', endDate: '', isActive: false })
      await loadYears()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create academic year.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell title="Academic Years" subtitle="Create and manage school years.">
      <section className="page-card">
        <form onSubmit={handleCreate} className="page-card">
          <input className="form-input" placeholder="Name (e.g. 2026-2027)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="form-input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input className="form-input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <label>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active year
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Year'}</button>
        </form>
        {error && <p className="field-error">{error}</p>}
      </section>

      <section className="page-card page-table-card">
        {loading ? <p>Loading...</p> : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Start</th><th>End</th><th>Active</th></tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.id}>
                  <td>{y.name}</td>
                  <td>{new Date(y.startDate).toLocaleDateString()}</td>
                  <td>{new Date(y.endDate).toLocaleDateString()}</td>
                  <td>{y.isActive ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </DashboardShell>
  )
}
