import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import FormModal from '../components/FormModal'

import { provisionStudentWithParent, provisionTeacher } from '../services/auth.service'

import {

  EDUCATION_LEVELS,

  gradesForEducationLevel

} from '../constants/classGrades'



const CreateAccountContext = createContext(null)



const emptyForm = {

  studentFullName: '',

  educationLevel: '',

  grade: '',

  parentName: '',

  parentIdentityCardNumber: '',

  parentPhoneNumber: '',

  parentEmail: '',

  teacherFullName: '',

  teacherEmail: '',

  teacherPhoneNumber: ''

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



  const gradeOptions = useMemo(

    () => gradesForEducationLevel(form.educationLevel),

    [form.educationLevel]

  )



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

    const { name, value } = event.target

    setForm((prev) => {

      if (name === 'educationLevel') {

        return { ...prev, educationLevel: value, grade: '' }

      }

      return { ...prev, [name]: value }

    })

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

          !form.educationLevel ||

          !form.grade ||

          !form.parentName.trim() ||

          !form.parentIdentityCardNumber.trim() ||

          !form.parentPhoneNumber.trim()

        ) {

          setError('Please fill in all student and parent fields, including education level and grade.')

          setCreating(false)

          return

        }



        response = await provisionStudentWithParent({

          studentFullName: form.studentFullName.trim(),

          educationLevel: form.educationLevel,

          grade: form.grade,

          parentName: form.parentName.trim(),

          parentIdentityCardNumber: form.parentIdentityCardNumber.trim(),

          parentPhoneNumber: form.parentPhoneNumber.trim(),

          ...(form.parentEmail.trim() ? { parentEmail: form.parentEmail.trim() } : {})

        })

      } else {

        if (!form.teacherFullName.trim() || !form.teacherEmail.trim() || !form.teacherPhoneNumber.trim()) {

          setError('Please fill in teacher full name, email, and phone number.')

          setCreating(false)

          return

        }



        response = await provisionTeacher({

          teacherFullName: form.teacherFullName.trim(),

          teacherEmail: form.teacherEmail.trim(),

          teacherPhoneNumber: form.teacherPhoneNumber.trim()

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

                <input

                  className="modal-field modal-form-span-2"

                  name="studentFullName"

                  placeholder="Student full name"

                  value={form.studentFullName}

                  onChange={handleChange}

                  required

                />

                <label className="modal-form-span-2 class-form-field">

                  <span className="modal-field-label">Education Level</span>

                  <select

                    className="modal-field"

                    name="educationLevel"

                    value={form.educationLevel}

                    onChange={handleChange}

                    required

                  >

                    <option value="">Select education level</option>

                    {EDUCATION_LEVELS.map((option) => (

                      <option key={option.value} value={option.value}>

                        {option.label}

                      </option>

                    ))}

                  </select>

                </label>

                {form.educationLevel ? (

                  <label className="modal-form-span-2 class-form-field">

                    <span className="modal-field-label">Grade</span>

                    <select

                      className="modal-field"

                      name="grade"

                      value={form.grade}

                      onChange={handleChange}

                      required

                    >

                      <option value="">Select grade</option>

                      {gradeOptions.map((grade) => (

                        <option key={grade} value={grade}>

                          {grade}

                        </option>

                      ))}

                    </select>

                    <p className="modal-field-hint modal-field-hint--info">

                      If this grade does not exist yet, a class will be created automatically.

                    </p>

                  </label>

                ) : null}

                <input className="modal-field" name="parentName" placeholder="Parent full name" value={form.parentName} onChange={handleChange} required />

                <input className="modal-field" name="parentIdentityCardNumber" placeholder="Parent identity card number" value={form.parentIdentityCardNumber} onChange={handleChange} />

                <input className="modal-field" name="parentPhoneNumber" placeholder="Parent phone number" value={form.parentPhoneNumber} onChange={handleChange} />

                <input className="modal-field modal-form-span-2" name="parentEmail" type="email" placeholder="Parent contact email (for credentials)" value={form.parentEmail} onChange={handleChange} />

              </>

            ) : (

              <>

                <input className="modal-field" name="teacherFullName" placeholder="Teacher full name" value={form.teacherFullName} onChange={handleChange} required />

                <input className="modal-field" name="teacherEmail" type="email" placeholder="Teacher email" value={form.teacherEmail} onChange={handleChange} required />

                <input className="modal-field" name="teacherPhoneNumber" type="tel" placeholder="Phone number" value={form.teacherPhoneNumber} onChange={handleChange} required />

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


