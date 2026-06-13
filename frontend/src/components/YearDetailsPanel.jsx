import { educationLevelFromClass } from '../constants/classGrades'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-muted">
        {message}
      </td>
    </tr>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="year-detail-stat">
      <span className="year-detail-stat-value">{value}</span>
      <span className="year-detail-stat-label">{label}</span>
    </div>
  )
}

export default function YearDetailsPanel({ year, loading }) {
  if (loading) {
    return (
      <section className="page-card">
        <p className="text-muted">Loading year details…</p>
      </section>
    )
  }

  if (!year) return null

  const summary = year.summary || {}

  return (
    <section className="page-card year-details-panel">
      <h2 className="section-heading">Year Details: {year.name}</h2>
      <p className="year-details-meta">
        Start: {formatDate(year.startDate)} | End: {formatDate(year.endDate)}
        {year.isArchived ? ` | Archived: ${formatDate(year.archivedAt)}` : null}
        {!year.isArchived ? ` | Status: ${year.isActive ? 'Active school year' : 'Inactive'}` : null}
      </p>

      <div className="year-detail-stats">
        <SummaryCard label="Classes" value={summary.classes ?? 0} />
        <SummaryCard label="Students" value={summary.students ?? 0} />
        <SummaryCard label="Teachers" value={summary.teachers ?? 0} />
        <SummaryCard label="Parents" value={summary.parents ?? 0} />
        <SummaryCard label="Courses" value={summary.courses ?? 0} />
        <SummaryCard label="Teaching assignments" value={summary.teachingAssignments ?? 0} />
        <SummaryCard label="Assignments" value={summary.assignments ?? 0} />
        <SummaryCard label="Grade records" value={summary.gradeRecords ?? 0} />
        <SummaryCard label="Attendance records" value={summary.attendances ?? 0} />
      </div>

      <h3 className="subsection-heading">Classes ({year.classes?.length || 0})</h3>
      <div className="year-details-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Room</th>
              <th>Education Level</th>
              <th>Grade</th>
              <th>Students</th>
              <th>Teachers</th>
              <th>Courses</th>
              <th>Assignments</th>
              <th>Grades</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {year.classes?.length ? (
              year.classes.map((klass) => (
                <tr key={klass.id}>
                  <td>{klass.name}</td>
                  <td>{klass.room}</td>
                  <td>{educationLevelFromClass(klass) || '—'}</td>
                  <td>{klass.grade || '—'}</td>
                  <td>{klass.studentCount ?? 0}</td>
                  <td>{klass.teacherCount ?? 0}</td>
                  <td>{klass.courseCount ?? 0}</td>
                  <td>{klass.assignmentCount ?? 0}</td>
                  <td>{klass.gradeRecordCount ?? 0}</td>
                  <td>{klass.attendanceCount ?? 0}</td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={10} message="No classes linked to this academic year." />
            )}
          </tbody>
        </table>
      </div>

      <h3 className="subsection-heading">Students ({year.students?.length || 0})</h3>
      <div className="year-details-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Class</th>
              <th>Grade</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {year.students?.length ? (
              year.students.map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.email}</td>
                  <td>{student.className}</td>
                  <td>{student.grade}</td>
                  <td>{student.status}</td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={5} message="No students enrolled in this year's classes." />
            )}
          </tbody>
        </table>
      </div>

      <h3 className="subsection-heading">Teachers ({year.teachers?.length || 0})</h3>
      <div className="year-details-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Subject</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Classes</th>
            </tr>
          </thead>
          <tbody>
            {year.teachers?.length ? (
              year.teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>{teacher.name}</td>
                  <td>{teacher.email}</td>
                  <td>{teacher.subject}</td>
                  <td>{teacher.phone || '—'}</td>
                  <td>{teacher.status}</td>
                  <td>{teacher.classes?.map((klass) => klass.name).join(', ') || '—'}</td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={6} message="No teachers assigned to this year's classes." />
            )}
          </tbody>
        </table>
      </div>

      <h3 className="subsection-heading">Parents ({year.parents?.length || 0})</h3>
      <div className="year-details-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>ID Card</th>
              <th>Children</th>
            </tr>
          </thead>
          <tbody>
            {year.parents?.length ? (
              year.parents.map((parent) => (
                <tr key={parent.id}>
                  <td>{parent.name}</td>
                  <td>{parent.email}</td>
                  <td>{parent.phoneNumber || '—'}</td>
                  <td>{parent.identityCardNumber || '—'}</td>
                  <td>
                    {parent.children?.map((child) => `${child.name} (${child.className})`).join(', ') || '—'}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={5} message="No parents linked to students in this year." />
            )}
          </tbody>
        </table>
      </div>

      <h3 className="subsection-heading">Courses ({year.courses?.length || 0})</h3>
      <div className="year-details-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Code</th>
              <th>Class</th>
              <th>Coefficient</th>
            </tr>
          </thead>
          <tbody>
            {year.courses?.length ? (
              year.courses.map((course) => (
                <tr key={`${course.classId}-${course.id}`}>
                  <td>{course.title}</td>
                  <td>{course.code || '—'}</td>
                  <td>{course.className}</td>
                  <td>{course.coefficient ?? '—'}</td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={4} message="No courses linked to this year's classes." />
            )}
          </tbody>
        </table>
      </div>

      <h3 className="subsection-heading">Teaching Assignments ({year.teachingAssignments?.length || 0})</h3>
      <div className="year-details-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Course</th>
              <th>Code</th>
              <th>Teacher</th>
              <th>Teacher Email</th>
            </tr>
          </thead>
          <tbody>
            {year.teachingAssignments?.length ? (
              year.teachingAssignments.map((item) => (
                <tr key={item.id}>
                  <td>{item.className}</td>
                  <td>{item.courseTitle}</td>
                  <td>{item.courseCode}</td>
                  <td>{item.teacherName}</td>
                  <td>{item.teacherEmail}</td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={5} message="No teaching assignments for this year." />
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
