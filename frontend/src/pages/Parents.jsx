import { useCallback, useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import FormModal from '../components/FormModal'
import { useConfirm } from '../context/ConfirmDialogContext'
import {
  deleteParent,
  getAllParents,
  getParentById,
  updateParent
} from '../services/auth.service'

const emptyForm = {
  name: '',
  email: '',
  identityCardNumber: '',
  phoneNumber: '',
  isActive: true
}

function parentToForm(parent) {
  return {
    name: parent.name || '',
    email: parent.email || '',
    identityCardNumber: parent.identityCardNumber || '',
    phoneNumber: parent.phoneNumber || '',
    isActive: parent.isActive !== false
  }
}

function ParentsContent() {
  const { confirm } = useConfirm()
  const [parents, setParents] = useState([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editingParent, setEditingParent] = useState(null)
  const [linkedChildren, setLinkedChildren] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [modalLoading, setModalLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchParents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAllParents()
      setParents(res.data?.data || [])
    } catch (err) {
      console.error('Error fetching parents:', err)
      setParents([])
      setError(err.response?.data?.message || 'Failed to load parents.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchParents()
  }, [fetchParents])

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    setError('')
    setSuccess('')
  }

  const closeEditModal = () => {
    if (saving) return
    setEditOpen(false)
    setEditingParent(null)
    setLinkedChildren([])
    setForm(emptyForm)
    setModalLoading(false)
    setError('')
  }

  const handleEdit = async (parent) => {
    setEditOpen(true)
    setEditingParent(parent)
    setForm(parentToForm(parent))
    setLinkedChildren([])
    setError('')
    setSuccess('')
    setModalLoading(true)
    try {
      const res = await getParentById(parent.id)
      const full = res.data?.data
      if (full) {
        setEditingParent(full)
        setForm(parentToForm(full))
        setLinkedChildren(
          (full.parentLinks || []).map((link) => link.student).filter(Boolean)
        )
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load parent details.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!editingParent) return

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.identityCardNumber.trim() ||
      !form.phoneNumber.trim()
    ) {
      setError('Name, email, identity card number, and phone are required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateParent(editingParent.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        identityCardNumber: form.identityCardNumber.trim(),
        phoneNumber: form.phoneNumber.trim(),
        isActive: form.isActive
      })
      setSuccess('Parent updated successfully.')
      closeEditModal()
      await fetchParents()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update parent.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (parent) => {
    const childCount = parent.childrenCount ?? 0
    const childNote =
      childCount > 0
        ? ` Their ${childCount} linked student${childCount === 1 ? '' : 's'} will also be removed.`
        : ''

    const confirmed = await confirm({
      title: 'Remove parent',
      message: `Remove parent "${parent.name}"? This removes their account and student links.${childNote}`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      variant: 'danger'
    })
    if (!confirmed) return

    setDeletingId(parent.id)
    setError('')
    setSuccess('')
    try {
      const res = await deleteParent(parent.id)
      setParents((prev) => prev.filter((p) => p.id !== parent.id))
      setSuccess(res.data?.message || `Parent "${parent.name}" was removed.`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove parent.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {error && !editOpen ? (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {success && !editOpen ? (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
      ) : null}

      {loading ? (
        <div className="page-card"><p>Loading parents...</p></div>
      ) : parents.length === 0 ? (
        <div className="page-card"><p>No parents found.</p></div>
      ) : (
        <section className="page-card page-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Children</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((parent) => (
                <tr key={parent.id}>
                  <td>{parent.name}</td>
                  <td>{parent.email}</td>
                  <td>{parent.phoneNumber || '—'}</td>
                  <td>{parent.childrenCount ?? 0}</td>
                  <td>
                    <span className={parent.isActive ? 'text-emerald-700' : 'text-amber-700'}>
                      {parent.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="actions-col">
                    <div className="table-actions table-actions--stacked">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleEdit(parent)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={deletingId === parent.id}
                        onClick={() => handleDelete(parent)}
                      >
                        {deletingId === parent.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {editOpen ? (
        <FormModal
          accent="orange"
          title="Edit Parent"
          subtitle={`Update account information for ${editingParent?.name || 'this parent'}.`}
          onClose={closeEditModal}
          closeDisabled={saving}
          footer={
            !modalLoading ? (
              <>
                <button type="button" className="modal-btn modal-btn--cancel" onClick={closeEditModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" form="edit-parent-form" className="modal-btn modal-btn--orange" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : null
          }
        >
          {error ? <p className="modal-alert modal-alert--error">{error}</p> : null}
          {modalLoading ? (
            <p className="text-sm text-slate-500">Loading parent details…</p>
          ) : (
            <form id="edit-parent-form" className="modal-form-grid" onSubmit={handleSave}>
              <input className="modal-field" name="name" placeholder="Full name" value={form.name} onChange={handleFormChange} required />
              <input className="modal-field" type="email" name="email" placeholder="Email" value={form.email} onChange={handleFormChange} required />
              <div className="form-row-2">
                <input className="modal-field" name="identityCardNumber" placeholder="Identity card number" value={form.identityCardNumber} onChange={handleFormChange} required />
                <input className="modal-field" name="phoneNumber" placeholder="Phone number" value={form.phoneNumber} onChange={handleFormChange} required />
              </div>
              <label className="modal-checkbox">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleFormChange} />
                Account active
              </label>
              {linkedChildren.length > 0 ? (
                <div className="modal-info-box">
                  <span className="modal-info-box-title">Linked students</span>
                  <ul className="list-disc pl-5">
                    {linkedChildren.map((child) => (
                      <li key={child.id}>{child.name} ({child.grade || 'N/A'})</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </form>
          )}
        </FormModal>
      ) : null}
    </>
  )
}

export default function Parents() {
  return (
    <DashboardShell title="Parents" subtitle="Review parent accounts and their access to student information.">
      <ParentsContent />
    </DashboardShell>
  )
}
