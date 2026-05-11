import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addCourseMaterial,
  deleteCourseMaterial,
  getAllCourses,
  listCourseMaterials,
  getTeacherClassSubjects,
  getTeacherClasses
} from '../services/auth.service'
import DashboardShell from '../components/DashboardShell'

const initialMaterialForm = { courseId: '', title: '', description: '', fileUrl: '', content: '' }

export default function Courses() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const isTeacher = user?.role === 'TEACHER'
  const canCreateMaterial = isAdmin || isTeacher

  const [courses, setCourses] = useState([])
  const [materials, setMaterials] = useState([])
  const [classes, setClasses] = useState([])
  const [teacherSubjects, setTeacherSubjects] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [materialForm, setMaterialForm] = useState(initialMaterialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = async () => {
    try {
      const [coursesRes, materialsRes] = await Promise.all([
        getAllCourses(),
        listCourseMaterials()
      ])
      setCourses(coursesRes.data?.data || [])
      setMaterials(materialsRes.data?.data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load courses.')
    }
  }

  useEffect(() => {
    refresh()
    if (isTeacher) {
      getTeacherClasses().then((response) => setClasses(response.data?.data || [])).catch(() => {})
    }
  }, [isTeacher])

  useEffect(() => {
    const load = async () => {
      if (!selectedClassId || !isTeacher) return
      try {
        const response = await getTeacherClassSubjects(selectedClassId)
        setTeacherSubjects(response.data?.data || [])
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load class subjects.')
      }
    }
    load()
  }, [selectedClassId, isTeacher])

  const handleSubmitMaterial = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!materialForm.courseId) {
      setError('Select a subject (course) first.')
      return
    }
    if (!materialForm.title.trim()) {
      setError('Provide a material title.')
      return
    }
    if (!materialForm.content.trim() && !materialForm.fileUrl.trim()) {
      setError('Provide either text content or a file URL.')
      return
    }
    setBusy(true)
    try {
      await addCourseMaterial(materialForm.courseId, {
        title: materialForm.title.trim(),
        description: materialForm.description.trim() || null,
        content: materialForm.content.trim() || null,
        fileUrl: materialForm.fileUrl.trim() || null
      })
      setMaterialForm(initialMaterialForm)
      setSuccess('Course material added.')
      await refresh()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save material.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm('Delete this material?')) return
    try {
      await deleteCourseMaterial(id)
      await refresh()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete material.')
    }
  }

  const subjectOptions = isTeacher
    ? teacherSubjects.map((subject) => ({ id: subject.id, title: subject.title }))
    : courses.map((course) => ({ id: course.id, title: course.title }))

  return (
    <DashboardShell
      title="Courses & Materials"
      subtitle={
        isAdmin
          ? 'All subjects and their published learning materials.'
          : isTeacher
          ? 'Publish course materials for your classes.'
          : 'Browse course materials shared by your teachers.'
      }
    >
      <div className="space-y-4">
        <section className="page-card page-table-card">
          <h3>Subjects</h3>
          {courses.length === 0 ? (
            <p>No subjects yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Title</th><th>Code</th><th>Coef.</th><th>Class</th></tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td>{course.title}</td>
                    <td>{course.code || '-'}</td>
                    <td>{course.coefficient || 1}</td>
                    <td>{course.class?.name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {canCreateMaterial ? (
          <section className="page-card">
            <form onSubmit={handleSubmitMaterial} className="page-card">
              <h3>New Course Material</h3>
              {isTeacher ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <select
                    className="form-input"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    <option value="">Select class</option>
                    {classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
                  </select>
                  <select
                    className="form-input"
                    value={materialForm.courseId}
                    onChange={(e) => setMaterialForm({ ...materialForm, courseId: e.target.value })}
                  >
                    <option value="">Select subject</option>
                    {subjectOptions.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.title}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <select
                  className="form-input"
                  value={materialForm.courseId}
                  onChange={(e) => setMaterialForm({ ...materialForm, courseId: e.target.value })}
                >
                  <option value="">Select subject</option>
                  {subjectOptions.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.title}</option>
                  ))}
                </select>
              )}
              <input
                className="form-input"
                placeholder="Title"
                value={materialForm.title}
                onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
              />
              <input
                className="form-input"
                placeholder="Description (optional)"
                value={materialForm.description}
                onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
              />
              <textarea
                className="form-input"
                placeholder="Text content (e.g. summary, notes)"
                value={materialForm.content}
                onChange={(e) => setMaterialForm({ ...materialForm, content: e.target.value })}
              />
              <input
                className="form-input"
                placeholder="File URL (e.g. https://...)"
                value={materialForm.fileUrl}
                onChange={(e) => setMaterialForm({ ...materialForm, fileUrl: e.target.value })}
              />
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Publish Material'}
              </button>
              {error ? <p className="field-error">{error}</p> : null}
              {success ? <p style={{ color: 'var(--success)' }}>{success}</p> : null}
            </form>
          </section>
        ) : null}

        <section className="page-card page-table-card">
          <h3>Available Materials</h3>
          {materials.length === 0 ? (
            <p>No materials yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>File / Content</th>
                  <th>Published</th>
                  {canCreateMaterial ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id}>
                    <td>{material.course?.title || '-'}</td>
                    <td>{material.title}</td>
                    <td>{material.description || '-'}</td>
                    <td>
                      {material.fileUrl ? (
                        <a href={material.fileUrl} target="_blank" rel="noreferrer">Open file</a>
                      ) : material.content ? (
                        <span title={material.content}>
                          {material.content.slice(0, 60)}{material.content.length > 60 ? '…' : ''}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{new Date(material.createdAt).toLocaleDateString()}</td>
                    {canCreateMaterial ? (
                      <td>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => handleDeleteMaterial(material.id)}
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
