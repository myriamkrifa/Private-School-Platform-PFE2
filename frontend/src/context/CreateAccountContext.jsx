import { createContext, useCallback, useContext, useState } from 'react'
import FormModal from '../components/FormModal'
import { provisionStudentWithParent, provisionTeacher } from '../services/auth.service'

const CreateAccountContext = createContext(null)

const emptyForm = {
  studentFullName: '',
  studentEmail: '',
  parentName: '',
  parentIdentityCardNumber: '',
  parentPhoneNumber: '',
  parentEmail: '',
  teacherFullName: '',
  teacherEmail: ''
}

export function CreateAccountProvider({ children }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [creationType, setCreationType] = useState('STUDENT')
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [createdVersion, setCreatedVersion] = useState(0)

  const openCreateModal = useCallback((type) => {
    setCreationType(type)
    setForm(emptyForm)
    setError('')
    setSuccess('')
    setCreatedCredentials(null)
    setModalOpen(true)
  }, [])

  const closeCreateModal = useCallback(() => {
    if (creating) return
    setModalOpen(false)
    setError('')
    setSuccess('')
    setCreatedCredentials(null)
  }, [creating])

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))
    setError('')
    setSuccess('')
    setCreatedCredentials(null)
  }

  const handleCreateUser = async (event) => {
    event.preventDefault()
    setCreating(true)
    try {
      let response
      if (creationType === 'STUDENT') {
        if (
          !form.studentFullName.trim() ||
          !form.studentEmail.trim() ||
          !form.parentName.trim() ||
          !form.parentIdentityCardNumber.trim() ||
          !form.parentPhoneNumber.trim()
        ) {
          setError('Please fill in all student and parent fields.')
          setCreating(false)
          return
        }

        response = await provisionStudentWithParent({
          studentFullName: form.studentFullName.trim(),
          studentEmail: form.studentEmail.trim(),
          parentName: form.parentName.trim(),
          parentIdentityCardNumber: form.parentIdentityCardNumber.trim(),
          parentPhoneNumber: form.parentPhoneNumber.trim(),
          ...(form.parentEmail.trim() ? { parentEmail: form.parentEmail.trim() } : {})
        })
      } else {
        if (!form.teacherFullName.trim() || !form.teacherEmail.trim()) {
          setError('Please fill in teacher full name and email.')
          setCreating(false)
          return
        }

        response = await provisionTeacher({
          teacherFullName: form.teacherFullName.trim(),
          teacherEmail: form.teacherEmail.trim()
        })
      }

      setForm(emptyForm)
      let successText = response.data?.message || 'Account created successfully.'
      if (response.data?.emailNotification?.sent) {
        successText += ' Parent credentials were sent by email.'
      } else if (response.data?.emailNotification && creationType === 'STUDENT') {
        successText += ' (Configure SMTP in backend .env to email parent credentials.)'
      }
      setSuccess(successText)
      setCreatedCredentials(response.data?.credentials || null)
      setCreatedVersion((v) => v + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create the account.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <CreateAccountContext.Provider value={{ openCreateModal, createdVersion }}>
      {children}

      {modalOpen ? (
        <FormModal
          accent={creationType === 'STUDENT' ? 'blue' : 'orange'}
          title={creationType === 'STUDENT' ? 'Create Student' : 'Create Teacher'}
          subtitle={
            creationType === 'STUDENT'
              ? 'Provision a student account with an auto-linked parent.'
              : 'Provision a teacher account.'
          }
          onClose={closeCreateModal}
          closeDisabled={creating}
          footer={
            <>
              <button type="button" className="modal-btn modal-btn--cancel" onClick={closeCreateModal} disabled={creating}>
                Cancel
              </button>
              <button
                type="submit"
                form="create-account-form"
                className={`modal-btn ${creationType === 'STUDENT' ? 'modal-btn--blue' : 'modal-btn--orange'}`}
                disabled={creating}
              >
                {creating ? 'Creating...' : creationType === 'STUDENT' ? 'Create Student + Parent' : 'Create Teacher'}
              </button>
            </>
          }
        >
          {error ? <p className="modal-alert modal-alert--error">{error}</p> : null}
          {success ? <p className="modal-alert modal-alert--success">{success}</p> : null}

          {createdCredentials ? (
            <div className="modal-info-box mb-3">
              <span className="modal-info-box-title">Generated credentials (show once)</span>
              {createdCredentials.student ? (
                <p>Student: {createdCredentials.student.email} / {createdCredentials.student.password}</p>
              ) : null}
              {createdCredentials.parent && createdCredentials.parent.password ? (
                <p>Parent (NEW): {createdCredentials.parent.email} / {createdCredentials.parent.password}</p>
              ) : createdCredentials.parent ? (
                <p>Parent (LINKED): {createdCredentials.parent.email}</p>
              ) : null}
              {createdCredentials.teacher ? (
                <p>Teacher: {createdCredentials.teacher.email} / {createdCredentials.teacher.password}</p>
              ) : null}
            </div>
          ) : null}

          <form
            id="create-account-form"
            className={`modal-form-grid ${creationType === 'STUDENT' ? 'modal-form-grid--two-col' : ''}`}
            onSubmit={handleCreateUser}
          >
            {creationType === 'STUDENT' ? (
              <>
                <input className="modal-field" name="studentFullName" placeholder="Student full name" value={form.studentFullName} onChange={handleChange} />
                <input className="modal-field" name="studentEmail" type="email" placeholder="Student email" value={form.studentEmail} onChange={handleChange} />
                <input className="modal-field" name="parentName" placeholder="Parent full name" value={form.parentName} onChange={handleChange} />
                <input className="modal-field" name="parentIdentityCardNumber" placeholder="Parent identity card number" value={form.parentIdentityCardNumber} onChange={handleChange} />
                <input className="modal-field" name="parentPhoneNumber" placeholder="Parent phone number" value={form.parentPhoneNumber} onChange={handleChange} />
                <input className="modal-field modal-form-span-2" name="parentEmail" type="email" placeholder="Parent contact email (for credentials)" value={form.parentEmail} onChange={handleChange} />
              </>
            ) : (
              <>
                <input className="modal-field" name="teacherFullName" placeholder="Teacher full name" value={form.teacherFullName} onChange={handleChange} />
                <input className="modal-field" name="teacherEmail" type="email" placeholder="Teacher email" value={form.teacherEmail} onChange={handleChange} />
              </>
            )}
          </form>
        </FormModal>
      ) : null}
    </CreateAccountContext.Provider>
  )
}

export function useCreateAccount() {
  const context = useContext(CreateAccountContext)
  if (!context) {
    throw new Error('useCreateAccount must be used within CreateAccountProvider')
  }
  return context
}
