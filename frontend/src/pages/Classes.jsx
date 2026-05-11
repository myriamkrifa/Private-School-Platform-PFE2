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

export default function Classes() {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [classForm, setClassForm] = useState({ name: '', room: '', level: 'PRIMARY' })
  const [studentIdToAdd, setStudentIdToAdd] = useState('')
  const [teacherIdToAdd, setTeacherIdToAdd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    setSelectedClass(res.data.data)
  }

  const createOrUpdate = async (event) => {
    event.preventDefault()
    setError('')
    try {
      if (selectedClass?.id) {
        await updateClass(selectedClass.id, classForm)
      } else {
        await createClass(classForm)
      }
      setClassForm({ name: '', room: '', level: 'PRIMARY' })
      setSelectedClass(null)
      await refresh()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save class.')
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Room</th>
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
                  <td>{kelas.teachers?.map((t) => t.name).join(', ') || 'N/A'}</td>
                  <td>{kelas._count?.students || 0}</td>
                  <td>
                    <button className="btn btn-primary" onClick={() => openDetails(kelas.id)}>Details</button>
                    {isAdmin ? (
                      <button
                        className="btn"
                        onClick={async () => {
                          if (!window.confirm('Delete this class?')) return
                          await deleteClass(kelas.id)
                          await refresh()
                          if (selectedClass?.id === kelas.id) setSelectedClass(null)
                        }}
                      >
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
          <form className="page-card" onSubmit={createOrUpdate}>
            <input className="form-input" placeholder="Name" value={classForm.name} onChange={(e) => setClassForm((p) => ({ ...p, name: e.target.value }))} />
            <input className="form-input" placeholder="Room" value={classForm.room} onChange={(e) => setClassForm((p) => ({ ...p, room: e.target.value }))} />
            <select className="form-input" value={classForm.level} onChange={(e) => setClassForm((p) => ({ ...p, level: e.target.value }))}>
              <option value="PRIMARY">PRIMARY</option>
              <option value="SECONDARY">SECONDARY</option>
            </select>
            <button className="btn btn-primary" type="submit">Save</button>
            {error ? <p className="field-error">{error}</p> : null}
          </form>
        </section>
      ) : null}

      {selectedClass ? (
        <section className="page-card">
          <h3>Class Details: {selectedClass.name}</h3>
          <p>Room: {selectedClass.room} | Level: {selectedClass.level}</p>

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
