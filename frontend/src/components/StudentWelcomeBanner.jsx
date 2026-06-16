import schoolLogo from '../assets/school-logo.png'
import { formatStudentId } from '../utils/studentId'

export default function StudentWelcomeBanner({ name, studentId }) {
  const firstName = (name || 'Student').trim().split(/\s+/)[0]
  const displayId = formatStudentId(studentId)

  return (
    <section className="student-welcome-banner" aria-label="Welcome message">
      <div className="student-welcome-banner-content">
        <p className="student-welcome-banner-greeting">Hello {firstName},</p>
        <h2 className="student-welcome-banner-title">Welcome to your school platform</h2>
        {displayId ? (
          <p className="student-welcome-banner-id">Student ID: <span>{displayId}</span></p>
        ) : null}
      </div>
      <div className="student-welcome-banner-logo-wrap">
        <img
          src={schoolLogo}
          alt="Private School Management Platform"
          className="student-welcome-banner-logo"
        />
      </div>
    </section>
  )
}
