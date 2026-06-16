import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  assignStudentToClass,
  assignTeacherToClass,
  createClass,
  createRoom,
  deleteClass,
  deleteRoom,
  getAllClasses,
  getAllRooms,
  getAllStudents,
  getAllTeachers,
  getClassById,
  removeStudentFromClass,
  removeTeacherFromClass,
  updateClass,
  updateRoom
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'
import FormModal from '../components/FormModal'
import { useConfirm } from '../context/ConfirmDialogContext'
import {
  EDUCATION_LEVELS,
  educationLevelFromClass,
  gradesForEducationLevel
} from '../constants/classGrades'

const emptyClassForm = {
  name: '',
  educationLevel: '',
  grade: ''
}

const emptyRoomForm = {
  name: ''
}

function classToForm(klass) {
  return {
    name: klass?.name || '',
    educationLevel: educationLevelFromClass(klass) || '',
    grade: klass?.grade || ''
  }
}

function roomToForm(room) {
  return {
    name: room?.name || ''
  }
}

export default function Classes() {
  const { user } = useAuth()
  const { confirm } = useConfirm()
  const [classes, setClasses] = useState([])
  const [rooms, setRooms] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [detailsClassId, setDetailsClassId] = useState(null)
  const [roomPanel, setRoomPanel] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [classForm, setClassForm] = useState(emptyClassForm)
  const [roomForm, setRoomForm] = useState(emptyRoomForm)
  const [studentIdToAdd, setStudentIdToAdd] = useState('')
  const [teacherIdToAdd, setTeacherIdToAdd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [roomFormOpen, setRoomFormOpen] = useState(false)
  const [editingClass, setEditingClass] = useState(null)
  const [editingRoom, setEditingRoom] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savingRoom, setSavingRoom] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [deletingRoomId, setDeletingRoomId] = useState(null)

  const isAdmin = user?.role === 'ADMIN'

  const refreshClasses = useCallback(async () => {
    const res = await getAllClasses()
    setClasses(res.data.data || [])
  }, [])

  const refreshRooms = useCallback(async () => {
    const res = await getAllRooms()
    setRooms(res.data.data || [])
  }, [])

  const refresh = useCallback(async () => {
    await refreshClasses()
    if (isAdmin) {
      await refreshRooms()
    }
  }, [refreshClasses, refreshRooms, isAdmin])

  useEffect(() => {
    const fetchData = async () => {
      setError('')
      try {
        await refreshClasses()
      } catch (err) {
        console.error('Error fetching classes:', err)
        setClasses([])
        setError(err.response?.data?.message || 'Failed to load classes.')
        setLoading(false)
        return
      }

      if (isAdmin) {
        try {
          const [studentsRes, teachersRes] = await Promise.all([getAllStudents(), getAllTeachers()])
          setStudents(studentsRes.data.data || [])
          setTeachers(teachersRes.data.data || [])
        } catch (err) {
          console.error('Error fetching class members:', err)
          setStudents([])
          setTeachers([])
          setError(err.response?.data?.message || 'Failed to load students and teachers.')
        }

        try {
          await refreshRooms()
        } catch (err) {
          console.error('Error fetching rooms:', err)
          setRooms([])
          setError((prev) => prev || err.response?.data?.message || 'Failed to load rooms.')
        }
      }

      setLoading(false)
    }
    fetchData()
  }, [isAdmin, refreshClasses, refreshRooms])

  const refreshClassDetails = useCallback(async (classId) => {
    const res = await getClassById(classId)
    setSelectedClass(res.data.data)
    return res.data.data
  }, [])

  const closeClassPanel = () => {
    setDetailsClassId(null)
    setSelectedClass(null)
    setDetailsLoading(false)
  }

  const toggleClassDetails = async (kelas) => {
    if (detailsClassId === kelas.id) {
      closeClassPanel()
      return
    }

    setDetailsClassId(kelas.id)
    setRoomPanel(null)
    setError('')
    setDetailsLoading(true)
    try {
      await refreshClassDetails(kelas.id)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load class details.')
      closeClassPanel()
    } finally {
      setDetailsLoading(false)
    }
  }

  const closeRoomPanel = () => {
    setRoomPanel(null)
    setEditingRoom(null)
    setRoomForm(emptyRoomForm)
  }

  const toggleRoomEdit = (room) => {
    if (roomPanel?.id === room.id) {
      closeRoomPanel()
      return
    }

    closeClassPanel()
    setRoomPanel({ id: room.id })
    setEditingRoom(room)
    setRoomForm(roomToForm(room))
    setError('')
  }

  const closeFormModal = () => {
    if (saving) return
    setFormOpen(false)
    setEditingClass(null)
    setClassForm(emptyClassForm)
    setError('')
  }

  const closeRoomFormModal = () => {
    if (savingRoom) return
    setRoomFormOpen(false)
    setEditingRoom(null)
    setRoomForm(emptyRoomForm)
    setError('')
  }

  const openCreateModal = () => {
    closeClassPanel()
    closeRoomPanel()
    setEditingClass(null)
    setClassForm(emptyClassForm)
    setError('')
    setSuccess('')
    setFormOpen(true)
  }

  const openCreateRoomModal = () => {
    closeRoomPanel()
    setEditingRoom(null)
    setRoomForm(emptyRoomForm)
    setError('')
    setRoomFormOpen(true)
  }

  const gradeOptions = useMemo(
    () => gradesForEducationLevel(classForm.educationLevel),
    [classForm.educationLevel]
  )

  const handleClassFormChange = (event) => {
    const { name, value } = event.target
    setClassForm((prev) => {
      if (name === 'educationLevel') {
        return { ...prev, educationLevel: value, grade: '' }
      }
      return { ...prev, [name]: value }
    })
    setError('')
  }

  const handleRoomFormChange = (event) => {
    const { name, value } = event.target
    setRoomForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSaveClass = async (event) => {
    event.preventDefault()
    setError('')

    if (!classForm.name.trim() || !classForm.educationLevel || !classForm.grade) {
      setError('Please fill in name, education level, and grade.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: classForm.name.trim(),
        educationLevel: classForm.educationLevel,
        grade: classForm.grade
      }

      if (editingClass?.id) {
        await updateClass(editingClass.id, payload)
        setSuccess(`Class "${payload.name}" updated.`)
        if (detailsClassId === editingClass.id) {
          await refreshClassDetails(editingClass.id)
        }
      } else {
        await createClass(payload)
        setSuccess(`Class "${payload.name}" created.`)
      }

      closeFormModal()
      await refresh()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save class.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRoom = async (event) => {
    event.preventDefault()
    setError('')

    if (!roomForm.name.trim()) {
      setError('Room name is required.')
      return
    }

    setSavingRoom(true)
    try {
      const payload = {
        name: roomForm.name.trim()
      }

      if (editingRoom?.id) {
        await updateRoom(editingRoom.id, payload)
        setSuccess(`Room "${payload.name}" updated.`)
      } else {
        await createRoom(payload)
        setSuccess(`Room "${payload.name}" created.`)
      }

      if (roomFormOpen) {
        closeRoomFormModal()
      } else {
        closeRoomPanel()
      }
      await refresh()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save room.')
    } finally {
      setSavingRoom(false)
    }
  }

  const handleDeleteClass = async (kelas) => {
    const confirmed = await confirm({
      title: 'Delete class',
      message: `Delete class "${kelas.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    })
    if (!confirmed) return

    setDeletingId(kelas.id)
    setError('')
    setSuccess('')
    try {
      await deleteClass(kelas.id)
      setSuccess(`Class "${kelas.name}" deleted.`)
      await refresh()
      if (selectedClass?.id === kelas.id) setSelectedClass(null)
      if (detailsClassId === kelas.id) closeClassPanel()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete class.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteRoom = async (room) => {
    const confirmed = await confirm({
      title: 'Delete room',
      message: `Delete room "${room.name}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    })
    if (!confirmed) return

    setDeletingRoomId(room.id)
    setError('')
    setSuccess('')
    try {
      await deleteRoom(room.id)
      setSuccess(`Room "${room.name}" deleted.`)
      if (roomPanel?.id === room.id) closeRoomPanel()
      await refresh()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete room.')
    } finally {
      setDeletingRoomId(null)
    }
  }

  const selectedClassStudentOptions = useMemo(() => {
    const currentIds = new Set((selectedClass?.students || []).map((s) => s.id))
    return students.filter((s) => !currentIds.has(s.id))
  }, [students, selectedClass])

  return (
    <DashboardShell title="Classes" subtitle="Manage classes and generate timetables with automatic room assignment.">
      {error && !formOpen && !roomFormOpen ? (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {success && !formOpen && !roomFormOpen ? (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
      ) : null}

      {isAdmin ? (
        <section className="page-card mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Classes</h2>
              <p className="text-sm text-slate-500">Create classes — rooms are assigned automatically in timetables.</p>
            </div>
            <button type="button" className="btn btn-primary btn-inline" onClick={openCreateModal}>
              + Create Class
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="page-card mb-4"><p>Loading classes...</p></div>
      ) : classes.length === 0 ? (
        <div className="page-card mb-4">
          <p>No classes found.</p>
          {isAdmin ? (
            <button type="button" className="btn btn-primary btn-inline" style={{ marginTop: '0.75rem' }} onClick={openCreateModal}>
              + Create Class
            </button>
          ) : null}
        </div>
      ) : (
        <section className="page-card page-table-card mb-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Education Level</th>
                <th>Grade</th>
                <th>Teachers</th>
                <th>Students</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((kelas) => {
                const isDetailsOpen = detailsClassId === kelas.id

                return (
                  <Fragment key={kelas.id}>
                    <tr>
                      <td>{kelas.name}</td>
                      <td>{educationLevelFromClass(kelas) || '—'}</td>
                      <td>{kelas.grade || '—'}</td>
                      <td>{kelas.teachers?.map((t) => t.name).join(', ') || 'N/A'}</td>
                      <td>{kelas._count?.students || 0}</td>
                      <td className="actions-col">
                        <div className="table-actions table-actions--stacked">
                          <button
                            type="button"
                            className={`btn btn-primary btn-sm${isDetailsOpen ? ' is-active' : ''}`}
                            onClick={() => toggleClassDetails(kelas)}
                          >
                            {isDetailsOpen ? 'Hide Details' : 'Details'}
                          </button>
                          {isAdmin ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={deletingId === kelas.id}
                              onClick={() => handleDeleteClass(kelas)}
                            >
                              {deletingId === kelas.id ? 'Deleting…' : 'Delete'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>

                    {isDetailsOpen ? (
                      <tr className="table-expand-row">
                        <td colSpan={6}>
                          <div className="table-expand-panel">
                            {detailsLoading ? (
                              <p className="text-muted">Loading class details…</p>
                            ) : selectedClass ? (
                              <>
                                <h3 className="table-expand-title">Class Details: {selectedClass.name}</h3>
                                <p className="text-muted">
                                  Education Level: {educationLevelFromClass(selectedClass) || '—'} | Grade:{' '}
                                  {selectedClass.grade || '—'}
                                </p>

                                <h4 className="section-heading">Students</h4>
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Name</th>
                                      <th>Email</th>
                                      {isAdmin ? <th>Action</th> : null}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(selectedClass.students || []).map((student) => (
                                      <tr key={student.id}>
                                        <td>{student.name}</td>
                                        <td>{student.email}</td>
                                        {isAdmin ? (
                                          <td>
                                            <button
                                              className="btn"
                                              type="button"
                                              onClick={async () => {
                                                await removeStudentFromClass(selectedClass.id, student.id)
                                                await refreshClassDetails(selectedClass.id)
                                                await refresh()
                                              }}
                                            >
                                              Remove
                                            </button>
                                          </td>
                                        ) : null}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                <h4 className="section-heading">Teachers</h4>
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Name</th>
                                      <th>Email</th>
                                      {isAdmin ? <th>Action</th> : null}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(selectedClass.teachers || []).map((teacher) => (
                                      <tr key={teacher.id}>
                                        <td>{teacher.name}</td>
                                        <td>{teacher.email}</td>
                                        {isAdmin ? (
                                          <td>
                                            <button
                                              className="btn"
                                              type="button"
                                              onClick={async () => {
                                                await removeTeacherFromClass(selectedClass.id, teacher.id)
                                                await refreshClassDetails(selectedClass.id)
                                                await refresh()
                                              }}
                                            >
                                              Remove
                                            </button>
                                          </td>
                                        ) : null}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {isAdmin ? (
                                  <div className="table-expand-subpanel">
                                    <h4 className="section-heading">Assign members</h4>
                                    <div className="assign-member-grid">
                                      <div className="assign-member-card">
                                        <label className="assign-member-field" htmlFor={`add-student-${kelas.id}`}>
                                          <span className="assign-member-label">Add Student</span>
                                          <select
                                            id={`add-student-${kelas.id}`}
                                            className="form-input"
                                            value={studentIdToAdd}
                                            onChange={(e) => setStudentIdToAdd(e.target.value)}
                                          >
                                            <option value="">Select student</option>
                                            {selectedClassStudentOptions.map((student) => (
                                              <option key={student.id} value={student.id}>
                                                {student.name}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <button
                                          className="btn btn-primary btn-inline assign-member-btn"
                                          type="button"
                                          disabled={!studentIdToAdd}
                                          onClick={async () => {
                                            if (!studentIdToAdd) return
                                            await assignStudentToClass(selectedClass.id, {
                                              studentId: Number(studentIdToAdd)
                                            })
                                            setStudentIdToAdd('')
                                            await refreshClassDetails(selectedClass.id)
                                            await refresh()
                                          }}
                                        >
                                          Add Student
                                        </button>
                                      </div>

                                      <div className="assign-member-card">
                                        <label className="assign-member-field" htmlFor={`add-teacher-${kelas.id}`}>
                                          <span className="assign-member-label">Add Teacher</span>
                                          <select
                                            id={`add-teacher-${kelas.id}`}
                                            className="form-input"
                                            value={teacherIdToAdd}
                                            onChange={(e) => setTeacherIdToAdd(e.target.value)}
                                          >
                                            <option value="">Select teacher</option>
                                            {teachers.map((teacher) => (
                                              <option key={teacher.id} value={teacher.id}>
                                                {teacher.name}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <button
                                          className="btn btn-primary btn-inline assign-member-btn"
                                          type="button"
                                          disabled={!teacherIdToAdd}
                                          onClick={async () => {
                                            if (!teacherIdToAdd) return
                                            await assignTeacherToClass(selectedClass.id, {
                                              teacherId: Number(teacherIdToAdd)
                                            })
                                            setTeacherIdToAdd('')
                                            await refreshClassDetails(selectedClass.id)
                                            await refresh()
                                          }}
                                        >
                                          Add Teacher
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-muted">No details available.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {isAdmin ? (
        <section className="page-card mb-4 mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Rooms</h2>
              <p className="text-sm text-slate-500">
                Create rooms here — each class rotates through several rooms automatically in timetables.
              </p>
            </div>
            <button type="button" className="btn btn-primary btn-inline" onClick={openCreateRoomModal}>
              + Create Room
            </button>
          </div>
        </section>
      ) : null}

      {isAdmin ? (
        rooms.length === 0 ? (
          <div className="page-card mb-4">
            <p>No rooms yet. Create rooms like A1, B2, or Lab 3.</p>
            <button
              type="button"
              className="btn btn-primary btn-inline"
              style={{ marginTop: '0.75rem' }}
              onClick={openCreateRoomModal}
            >
              + Create Room
            </button>
          </div>
        ) : (
          <section className="page-card page-table-card mb-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const isEditOpen = roomPanel?.id === room.id

                  return (
                    <Fragment key={room.id}>
                      <tr>
                        <td>{room.name}</td>
                        <td className="actions-col">
                          <div className="table-actions table-actions--stacked">
                            <button
                              type="button"
                              className={`btn btn-primary btn-sm${isEditOpen ? ' is-active' : ''}`}
                              onClick={() => toggleRoomEdit(room)}
                            >
                              {isEditOpen ? 'Hide Edit' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={deletingRoomId === room.id}
                              onClick={() => handleDeleteRoom(room)}
                            >
                              {deletingRoomId === room.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isEditOpen ? (
                        <tr className="table-expand-row">
                          <td colSpan={2}>
                            <div className="table-expand-panel">
                              <h3 className="table-expand-title">Edit Room: {room.name}</h3>
                              <form className="class-form-grid" onSubmit={handleSaveRoom}>
                                <label className="class-form-field class-form-span-all">
                                  <span className="class-form-label">Room name</span>
                                  <input
                                    className="form-input"
                                    name="name"
                                    autoComplete="off"
                                    value={roomForm.name}
                                    onChange={handleRoomFormChange}
                                    required
                                  />
                                </label>
                                <div className="class-form-actions class-form-span-all">
                                  <button type="button" className="btn btn-sm" onClick={closeRoomPanel}>
                                    Cancel
                                  </button>
                                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingRoom}>
                                    {savingRoom ? 'Saving…' : 'Save changes'}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </section>
        )
      ) : null}

      {formOpen ? (
        <FormModal
          accent="orange"
          title={editingClass ? 'Edit Class' : 'Create Class'}
          subtitle={editingClass ? `Update ${editingClass.name}.` : 'Add a new class for the active academic year.'}
          onClose={closeFormModal}
          closeDisabled={saving}
          footer={
            <>
              <button type="button" className="modal-btn modal-btn--cancel" onClick={closeFormModal} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form="class-form" className="modal-btn modal-btn--orange" disabled={saving}>
                {saving ? 'Saving…' : editingClass ? 'Save changes' : 'Create class'}
              </button>
            </>
          }
        >
          <form id="class-form" className="class-form-grid" onSubmit={handleSaveClass}>
            <label className="class-form-field class-form-span-all">
              <span className="class-form-label">Name</span>
              <input
                className="form-input"
                name="name"
                placeholder="e.g. Primary 1"
                value={classForm.name}
                onChange={handleClassFormChange}
                required
              />
            </label>
            <label className="class-form-field">
              <span className="class-form-label">Education Level</span>
              <select
                className="form-input"
                name="educationLevel"
                value={classForm.educationLevel}
                onChange={handleClassFormChange}
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
            {classForm.educationLevel ? (
              <label className="class-form-field">
                <span className="class-form-label">Grade</span>
                <select
                  className="form-input"
                  name="grade"
                  value={classForm.grade}
                  onChange={handleClassFormChange}
                  required
                >
                  <option value="">Select grade</option>
                  {gradeOptions.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {error ? <p className="field-error class-form-span-all">{error}</p> : null}
          </form>
        </FormModal>
      ) : null}

      {roomFormOpen ? (
        <FormModal
          accent="blue"
          title={editingRoom ? 'Edit Room' : 'Create Room'}
          subtitle="Rooms are distributed automatically across classes when timetables are generated."
          onClose={closeRoomFormModal}
          closeDisabled={savingRoom}
          footer={
            <>
              <button type="button" className="modal-btn modal-btn--cancel" onClick={closeRoomFormModal} disabled={savingRoom}>
                Cancel
              </button>
              <button type="submit" form="room-form" className="modal-btn modal-btn--blue" disabled={savingRoom}>
                {savingRoom ? 'Saving…' : editingRoom ? 'Save changes' : 'Create room'}
              </button>
            </>
          }
        >
          <form id="room-form" className="class-form-grid" onSubmit={handleSaveRoom}>
            <label className="class-form-field class-form-span-all">
              <span className="class-form-label">Room name</span>
              <input
                className="form-input"
                name="name"
                autoComplete="off"
                placeholder="e.g. A1, B2, Lab 3"
                value={roomForm.name}
                onChange={handleRoomFormChange}
                required
              />
            </label>
            {error ? <p className="field-error class-form-span-all">{error}</p> : null}
          </form>
        </FormModal>
      ) : null}
    </DashboardShell>
  )
}
