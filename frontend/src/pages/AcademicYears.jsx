import { useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Check } from 'lucide-react'
import {
  activateAcademicYear,
  archiveAcademicYear,
  createAcademicYear,
  deleteAcademicYear,
  getAcademicYearById,
  getAcademicYears,
  restoreAcademicYear
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'
import YearDetailsPanel from '../components/YearDetailsPanel'
import { DeleteIconButton } from '../components/TableIconButtons'
import { useConfirm } from '../context/ConfirmDialogContext'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export default function AcademicYears() {
  const { confirm } = useConfirm()
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', isActive: false })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const loadYears = async () => {
    setLoading(true)
    try {
      const res = await getAcademicYears({ includeArchived: true })
      setYears(res.data.data || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load academic years.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadYears()
  }, [])

  const activeYears = useMemo(
    () => years.filter((y) => !y.isArchived).sort((a, b) => new Date(b.startDate) - new Date(a.startDate)),
    [years]
  )

  const archivedYears = useMemo(
    () => years.filter((y) => y.isArchived).sort((a, b) => new Date(b.archivedAt || b.startDate) - new Date(a.archivedAt || a.startDate)),
    [years]
  )

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await createAcademicYear(form)
      setForm({ name: '', startDate: '', endDate: '', isActive: false })
      setSuccess('Academic year created.')
      await loadYears()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create academic year.')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (year) => {
    if (year.isActive) return
    setActionId(year.id)
    setError('')
    setSuccess('')
    try {
      await activateAcademicYear(year.id)
      setSuccess(`"${year.name}" is now the active school year.`)
      await loadYears()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to activate academic year.')
    } finally {
      setActionId(null)
    }
  }

  const handleArchive = async (year) => {
    const message = year.isActive
      ? `"${year.name}" is the active year. Archiving will deactivate it. All classes, grades, attendance, assignments, and reports for this year will be preserved as read-only history. Continue?`
      : `Archive "${year.name}"? All related school data will be preserved for historical reference and cannot be edited while archived.`

    const confirmed = await confirm({
      title: 'Archive academic year',
      message,
      confirmLabel: 'Archive',
      cancelLabel: 'Cancel',
      variant: 'danger'
    })
    if (!confirmed) return

    setActionId(year.id)
    setError('')
    setSuccess('')
    try {
      await archiveAcademicYear(year.id)
      setSuccess(`"${year.name}" archived. Historical records are preserved.`)
      await loadYears()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to archive academic year.')
    } finally {
      setActionId(null)
    }
  }

  const openDetails = async (year) => {
    setDetailsLoading(true)
    setSelectedYear({
      id: year.id,
      name: year.name,
      startDate: year.startDate,
      endDate: year.endDate,
      isActive: year.isActive,
      isArchived: year.isArchived,
      archivedAt: year.archivedAt
    })
    setError('')
    try {
      const res = await getAcademicYearById(year.id)
      setSelectedYear(res.data.data)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load academic year details.')
      setSelectedYear(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleDelete = async (year) => {
    const message = year.isActive
      ? `"${year.name}" is the active school year. Deleting it will remove this year and unlink its classes. Continue?`
      : `Permanently delete "${year.name}"? Classes linked to this year will be kept but no longer assigned to it.`

    const confirmed = await confirm({
      title: 'Delete academic year',
      message,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    })
    if (!confirmed) return

    setActionId(year.id)
    setError('')
    setSuccess('')
    try {
      await deleteAcademicYear(year.id)
      if (selectedYear?.id === year.id) setSelectedYear(null)
      setSuccess(`"${year.name}" deleted.`)
      await loadYears()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete academic year.')
    } finally {
      setActionId(null)
    }
  }

  const handleRestore = async (year) => {
    const confirmed = await confirm({
      title: 'Restore academic year',
      message: `Restore "${year.name}" to the active years list? It will not be marked as the active school year automatically.`,
      confirmLabel: 'Restore',
      cancelLabel: 'Cancel',
      variant: 'primary'
    })
    if (!confirmed) return

    setActionId(year.id)
    setError('')
    setSuccess('')
    try {
      await restoreAcademicYear(year.id)
      setSuccess(`"${year.name}" restored.`)
      setTab('active')
      await loadYears()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to restore academic year.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <DashboardShell
      title="Academic Years"
      subtitle="Manage current school years and preserve past years as read-only archives."
    >
      <div className="year-tabs" role="tablist" aria-label="Academic year views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          className={`year-tab${tab === 'active' ? ' year-tab-active' : ''}`}
          onClick={() => setTab('active')}
        >
          Active Years
          {activeYears.length > 0 ? <span className="year-tab-count">{activeYears.length}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'archived'}
          className={`year-tab${tab === 'archived' ? ' year-tab-active' : ''}`}
          onClick={() => setTab('archived')}
        >
          Archived Years
          {archivedYears.length > 0 ? <span className="year-tab-count">{archivedYears.length}</span> : null}
        </button>
      </div>

      {error ? <p className="field-error page-feedback">{error}</p> : null}
      {success ? <p className="page-success page-feedback">{success}</p> : null}

      {tab === 'active' ? (
        <>
          <section className="page-card">
            <h2 className="section-heading">Create academic year</h2>
            <form onSubmit={handleCreate} className="academic-year-form">
              <input
                className="form-input"
                placeholder="Name (e.g. 2026-2027)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                className="form-input"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
              <input
                className="form-input"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Set as active school year
              </label>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Create Year'}
              </button>
            </form>
          </section>

          <section className="page-card page-table-card">
            <h2 className="section-heading">Active Years</h2>
            {loading ? (
              <p>Loading...</p>
            ) : activeYears.length === 0 ? (
              <p className="text-muted">No active academic years yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Active</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeYears.map((y) => (
                    <tr key={y.id}>
                      <td>{y.name}</td>
                      <td>{formatDate(y.startDate)}</td>
                      <td>{formatDate(y.endDate)}</td>
                      <td>
                        {y.isActive ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={actionId === y.id}
                            onClick={() => handleActivate(y)}
                          >
                            Set active
                          </button>
                        )}
                      </td>
                      <td className="actions-col">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => openDetails(y)}
                            disabled={detailsLoading && selectedYear?.id === y.id}
                          >
                            Details
                          </button>
                          <DeleteIconButton
                            label={`Delete ${y.name}`}
                            loading={actionId === y.id}
                            onClick={() => handleDelete(y)}
                          />
                          {y.isActive ? (
                            <span className="table-action-hint" title="Current active year">
                              <Check size={16} aria-hidden />
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="btn-icon"
                            title={`Archive ${y.name}`}
                            aria-label={`Archive ${y.name}`}
                            disabled={actionId === y.id}
                            onClick={() => handleArchive(y)}
                          >
                            <Archive size={18} aria-hidden />
                            <span className="sr-only">Archive</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : (
        <section className="page-card page-table-card">
          <h2 className="section-heading section-heading-archived">
            <Archive size={18} aria-hidden />
            Archived Years
          </h2>
          <p className="archived-years-note">
            Archived years are read-only historical records. Classes, students, grades, attendance,
            assignments, and reports linked to these years remain available for consultation.
          </p>
          {loading ? (
            <p>Loading...</p>
          ) : archivedYears.length === 0 ? (
            <p className="text-muted">No archived academic years.</p>
          ) : (
            <table className="data-table data-table-archived">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Archived Date</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedYears.map((y) => (
                  <tr key={y.id} className="archived-year-row">
                    <td>
                      <span className="archived-year-name">
                        <Archive size={16} aria-hidden />
                        {y.name}
                      </span>
                    </td>
                    <td>{formatDate(y.startDate)}</td>
                    <td>{formatDate(y.endDate)}</td>
                    <td>{formatDate(y.archivedAt)}</td>
                    <td className="actions-col">
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => openDetails(y)}
                          disabled={detailsLoading && selectedYear?.id === y.id}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={actionId === y.id}
                          onClick={() => handleRestore(y)}
                        >
                          <ArchiveRestore size={16} aria-hidden />
                          Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {selectedYear ? <YearDetailsPanel year={selectedYear} loading={detailsLoading} /> : null}
    </DashboardShell>
  )
}
