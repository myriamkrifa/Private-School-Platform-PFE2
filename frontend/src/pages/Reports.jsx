import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import {
  exportClassReport,
  getAllClasses,
  getAllStudents,
  getClassReport,
  getStudentReport,
  getTeacherWorkloadReport
} from '../services/auth.service'

function StatusRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}

export default function Reports() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [classReport, setClassReport] = useState(null)
  const [studentReport, setStudentReport] = useState(null)
  const [workload, setWorkload] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [classesRes, studentsRes, workloadRes] = await Promise.all([
          getAllClasses(),
          getAllStudents(),
          getTeacherWorkloadReport()
        ])
        setClasses(classesRes.data?.data || [])
        setStudents(studentsRes.data?.data || [])
        setWorkload(workloadRes.data?.data || [])
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load reports data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleClassReport = async (event) => {
    event.preventDefault()
    setError('')
    setClassReport(null)
    if (!selectedClass) return
    try {
      const response = await getClassReport(selectedClass)
      setClassReport(response.data?.data || null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load class report.')
    }
  }

  const handleStudentReport = async (event) => {
    event.preventDefault()
    setError('')
    setStudentReport(null)
    if (!selectedStudent) return
    try {
      const response = await getStudentReport(selectedStudent)
      setStudentReport(response.data?.data || null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load student report.')
    }
  }

  const handleClassExport = async () => {
    if (!selectedClass) return
    try {
      const response = await exportClassReport(selectedClass)
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `class-${selectedClass}-report.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export class report.')
    }
  }

  return (
    <DashboardShell title="Reports" subtitle="Per-class averages, per-student summaries, and teacher workload.">
      <div className="space-y-4">
        {error ? <div className="page-card"><p className="field-error">{error}</p></div> : null}

        <section className="page-card">
          <form onSubmit={handleClassReport} className="page-card">
            <h3>Class Report</h3>
            <select
              className="form-input"
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              <option value="">Select a class</option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>{klass.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={!selectedClass}>Generate</button>
              <button className="btn" type="button" onClick={handleClassExport} disabled={!selectedClass}>Export CSV</button>
            </div>
          </form>

          {classReport ? (
            <div className="page-card space-y-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <StatusRow label="Class" value={classReport.class?.name || '-'} />
                <StatusRow label="Students" value={classReport.studentsCount} />
                <StatusRow label="Grades recorded" value={classReport.gradesCount} />
                <StatusRow label="Overall Average" value={classReport.overallAverage ?? '—'} />
                <StatusRow label="Weighted Average" value={classReport.weightedAverage ?? '—'} />
                <StatusRow
                  label="Attendance Present"
                  value={`${classReport.attendanceSummary?.PRESENT || 0}`}
                />
              </div>

              <div className="page-table-card">
                <h4>Per-subject averages</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Coef.</th>
                      <th>Grades</th>
                      <th>Average</th>
                      <th>Teachers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(classReport.subjectAverages || []).map((row) => (
                      <tr key={row.subjectId}>
                        <td>{row.subjectTitle}</td>
                        <td>{row.coefficient ?? 1}</td>
                        <td>{row.gradesCount}</td>
                        <td>{row.average ?? '—'}</td>
                        <td>
                          {(row.teachers || []).map((t) => t.name).join(', ') || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="page-table-card">
                <h4>Attendance summary</h4>
                <table className="data-table">
                  <thead>
                    <tr><th>Status</th><th>Count</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(classReport.attendanceSummary || {}).map(([status, count]) => (
                      <tr key={status}><td>{status}</td><td>{count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        <section className="page-card">
          <form onSubmit={handleStudentReport} className="page-card">
            <h3>Student Report</h3>
            <select
              className="form-input"
              value={selectedStudent}
              onChange={(event) => setSelectedStudent(event.target.value)}
            >
              <option value="">Select a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} {student.classId ? '' : '(no class)'}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" type="submit" disabled={!selectedStudent}>Generate</button>
          </form>

          {studentReport ? (
            <div className="page-card space-y-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <StatusRow label="Student" value={studentReport.student?.name || '-'} />
                <StatusRow label="Class" value={studentReport.class?.name || '-'} />
                <StatusRow label="Grades" value={studentReport.gradesCount} />
                <StatusRow label="Overall Average" value={studentReport.overallAverage ?? '—'} />
                <StatusRow label="Weighted Average" value={studentReport.weightedAverage ?? '—'} />
                <StatusRow
                  label="Absences"
                  value={studentReport.attendanceSummary?.ABSENT || 0}
                />
              </div>

              <div className="page-table-card">
                <h4>Per-subject averages</h4>
                <table className="data-table">
                  <thead>
                    <tr><th>Subject</th><th>Coef.</th><th>Grades</th><th>Average</th></tr>
                  </thead>
                  <tbody>
                    {(studentReport.subjectAverages || []).map((row, index) => (
                      <tr key={`${row.subjectId || 'x'}-${index}`}>
                        <td>{row.subjectTitle}</td>
                        <td>{row.coefficient ?? 1}</td>
                        <td>{row.gradesCount}</td>
                        <td>{row.average ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="page-table-card">
                <h4>Linked parents</h4>
                {(studentReport.parents || []).length === 0 ? (
                  <p>No parents linked yet.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Phone</th></tr>
                    </thead>
                    <tbody>
                      {studentReport.parents.map((parent) => (
                        <tr key={parent.id}>
                          <td>{parent.name}</td>
                          <td>{parent.email}</td>
                          <td>{parent.phoneNumber || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="page-card">
          <h3>Teacher Workload</h3>
          {loading ? (
            <p>Loading…</p>
          ) : workload.length === 0 ? (
            <p>No teaching assignments yet.</p>
          ) : (
            <div className="page-table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Specialty</th>
                    <th>Classes</th>
                    <th>Subjects</th>
                    <th>Total assignments</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.map((row) => (
                    <tr key={row.teacherId}>
                      <td>{row.name}</td>
                      <td>{row.specialty || '-'}</td>
                      <td>{row.classesCount}</td>
                      <td>{row.subjectsCount}</td>
                      <td>{row.assignmentsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
