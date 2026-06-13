import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  assignStudentToClass,
  assignTeacherToClass,
  createClass,
  deleteClass,
  getAllClasses,
  getAllStudents,
  getAllTeachers,
  getClassById,
  removeStudentFromClass,
  removeTeacherFromClass,
  updateClass
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'
import { useConfirm } from '../context/ConfirmDialogContext'
import {
  EDUCATION_LEVELS,
  educationLevelFromClass,
  gradesForEducationLevel
} from '../constants/classGrades'

const emptyClassForm = {
  name: '',
  room: '',
  educationLevel: '',
  grade: ''
}

export default function Classes() {
  const { user } = useAuth()
  const { confirm } = useConfirm()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [classForm, setClassForm] = useState(emptyClassForm)
  const [studentIdToAdd, setStudentIdToAdd] = useState('')
  const [teacherIdToAdd, setTeacherIdToAdd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roomEdit, setRoomEdit] = useState('')
  const [savingRoom, setSavingRoom] = useState(false)

  const isAdmin = user?.role === 'ADMIN'

  const refresh = async () => {
    const res = await getAllClasses()
    setClasses(res.data.data || [])
  }

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        await refresh()
        if (isAdmin) {
          const [studentsRes, teachersRes] = await Promise.all([getAllStudents(), getAllTeachers()])
          setStudents(studentsRes.data.data || [])
          setTeachers(teachersRes.data.data || [])
        }
      } catch (error) {
        console.error('Error fetching classes:', error)
        setClasses([])
      } finally {
        setLoading(false)
      }
    }
    fetchClasses()
  }, [isAdmin])

  const openDetails = async (classId) => {
    const res = await getClassById(classId)
    const data = res.data.data
    setSelectedClass(data)
    setRoomEdit(data?.room || '')
  }

  const handleSaveRoom = async (event) => {
    event.preventDefault()
    if (!selectedClass?.id) return

    const trimmedRoom = roomEdit.trim()
    if (!trimmedRoom) {
      setError('Room is required.')
      return
    }

    setSavingRoom(true)
    setError('')
    try {
      await updateClass(selectedClass.id, { room: trimmedRoom })
      await openDetails(selectedClass.id)
      await refresh()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update room.')
    } finally {
      setSavingRoom(false)
    }
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
  }

  const createOrUpdate = async (event) => {
    event.preventDefault()
    setError('')

    if (!classForm.name.trim() || !classForm.room.trim() || !classForm.educationLevel || !classForm.grade) {
      setError('Please fill in name, room, education level, and grade.')
      return
    }

    try {
      const payload = {
        name: classForm.name.trim(),
        room: classForm.room.trim(),
        educationLevel: classForm.educationLevel,
        grade: classForm.grade
      }

      if (selectedClass?.id) {
        await updateClass(selectedClass.id, payload)
      } else {
        await createClass(payload)
      }
      setClassForm(emptyClassForm)
      setSelectedClass(null)
      await refresh()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save class.')
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

    setError('')
    try {
      await deleteClass(kelas.id)
      await refresh()
      if (selectedClass?.id === kelas.id) setSelectedClass(null)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete class.')
    }
  }

  const selectedClassStudentOptions = useMemo(() => {
    const currentIds = new Set((selectedClass?.students || []).map((s) => s.id))
    return students.filter((s) => !currentIds.has(s.id))
  }, [students, selectedClass])

  return (
    <DashboardShell title="Classes" subtitle="See the active class list and teacher assignments.">
      {loading ? (
        <div className="page-card"><p>Loading classes...</p></div>
      ) : classes.length === 0 ? (
        <div className="page-card"><p>No classes found.</p></div>
      ) : (
        <section className="page-card page-table-card">
          {error ? <p className="field-error" style={{ marginBottom: '0.75rem' }}>{error}</p> : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Room</th>
                <th>Education Level</th>
                <th>Grade</th>
                <th>Teachers</th>
                <th>Students</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((kelas) => (
                <tr key={kelas.id}>
                  <td>{kelas.name}</td>
                  <td>{kelas.room}</td>
                  <td>{educationLevelFromClass(kelas) || '—'}</td>
                  <td>{kelas.grade || '—'}</td>
                  <td>{kelas.teachers?.map((t) => t.name).join(', ') || 'N/A'}</td>
                  <td>{kelas._count?.students || 0}</td>
                  <td>
                    <button className="btn btn-primary" onClick={() => openDetails(kelas.id)}>Details</button>
                    {isAdmin ? (
                      <button className="btn" type="button" onClick={() => handleDeleteClass(kelas)}>
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {isAdmin ? (
        <section className="page-card">
          <h3>{selectedClass?.id ? 'Edit Class' : 'Create Class'}</h3>
          <form className="class-form-grid page-card" onSubmit={createOrUpdate}>
            <label className="class-form-field">
              <span className="class-form-label">Name</span>
              <input
                className="form-input"
                name="name"
                placeholder="Name"
                value={classForm.name}
                onChange={handleClassFormChange}
                required
              />
            </label>
            <label className="class-form-field">
              <span className="class-form-label">Room</span>
              <input
                className="form-input"
                name="room"
                placeholder="Room"
                value={classForm.room}
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
            <div className="class-form-actions">
              <button className="btn btn-primary" type="submit">Save</button>
            </div>
            {error ? <p className="field-error class-form-span-all">{error}</p> : null}
          </form>
        </section>
      ) : null}

      {selectedClass ? (
        <section className="page-card">
          <h3>Class Details: {selectedClass.name}</h3>
          <p>
            Education Level: {educationLevelFromClass(selectedClass) || '—'} | Grade: {selectedClass.grade || '—'}
          </p>
          {isAdmin ? (
            <form className="class-room-edit" onSubmit={handleSaveRoom}>
              <label className="class-form-field class-room-edit-field">
                <span className="class-form-label">Room</span>
                <input
                  className="form-input"
                  value={roomEdit}
                  onChange={(e) => setRoomEdit(e.target.value)}
                  placeholder="e.g. A12, Lab 3"
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={savingRoom}>
                {savingRoom ? 'Saving…' : 'Save room'}
              </button>
            </form>
          ) : (
            <p>Room: {selectedClass.room}</p>
          )}

          <h4>Students</h4>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th>{isAdmin ? <th>Action</th> : null}</tr></thead>
            <tbody>
              {(selectedClass.students || []).map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.email}</td>
                  {isAdmin ? (
                    <td><button className="btn" onClick={async () => { await removeStudentFromClass(selectedClass.id, student.id); await openDetails(selectedClass.id); await refresh() }}>Remove</button></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>

          <h4>Teachers</h4>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th>{isAdmin ? <th>Action</th> : null}</tr></thead>
            <tbody>
              {(selectedClass.teachers || []).map((teacher) => (
                <tr key={teacher.id}>
                  <td>{teacher.name}</td>
                  <td>{teacher.email}</td>
                  {isAdmin ? (
                    <td><button className="btn" onClick={async () => { await removeTeacherFromClass(selectedClass.id, teacher.id); await openDetails(selectedClass.id); await refresh() }}>Remove</button></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>

          {isAdmin ? (
            <div className="page-card">
              <h4>Add Student</h4>
              <select className="form-input" value={studentIdToAdd} onChange={(e) => setStudentIdToAdd(e.target.value)}>
                <option value="">Select student</option>
                {selectedClassStudentOptions.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
              <button className="btn btn-primary" onClick={async () => { if (!studentIdToAdd) return; await assignStudentToClass(selectedClass.id, { studentId: Number(studentIdToAdd) }); setStudentIdToAdd(''); await openDetails(selectedClass.id); await refresh() }}>Add Student</button>

              <h4>Add Teacher</h4>
              <select className="form-input" value={teacherIdToAdd} onChange={(e) => setTeacherIdToAdd(e.target.value)}>
                <option value="">Select teacher</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
              <button className="btn btn-primary" onClick={async () => { if (!teacherIdToAdd) return; await assignTeacherToClass(selectedClass.id, { teacherId: Number(teacherIdToAdd) }); setTeacherIdToAdd(''); await openDetails(selectedClass.id); await refresh() }}>Add Teacher</button>
            </div>
          ) : null}
        </section>
      ) : null}
    </DashboardShell>
  )
}
