/**
 * School Data AI — answers from live database (no OpenAI required).
 */

function formatList(items, formatter, empty = 'None recorded.') {
  if (!items?.length) return empty
  return items.map(formatter).join('\n')
}

const handlers = [
  {
    id: 'students_count',
    patterns: [/how many students|number of students|total students|students registered|count students/i],
    answer: (ctx) => {
      const s = ctx.summary
      return `**Students registered:** ${s.totalStudents}\n\n**By status:**\n${formatList(
        ctx.enrollmentByStatus,
        (e) => `- ${e.status}: ${e.count}`,
        '- No status breakdown available.'
      )}`
    }
  },
  {
    id: 'teachers_list',
    patterns: [/list.*teachers|all teachers|who are the teachers|show teachers/i],
    answer: (ctx) =>
      `**Teachers (${ctx.summary.totalTeachers} total):**\n\n${formatList(
        ctx.teachers,
        (t) =>
          `- **${t.name}** — ${t.subject || 'General'} (${t.status}), ${t.classesCount} class(es), ${t.assignmentsCount} assignment(s)`,
        'No teachers found in the database.'
      )}`
  },
  {
    id: 'students_per_class',
    patterns: [/students.*each class|students per class|how many.*in each class|class enrollment|students in class/i],
    answer: (ctx) =>
      `**Students per class:**\n\n${formatList(
        ctx.studentsPerClass,
        (c) =>
          `- **${c.className}** (${c.level}): ${c.studentCount} student(s), ${c.teacherCount} teacher(s)`,
        'No classes found.'
      )}`
  },
  {
    id: 'active_year',
    patterns: [/active.*academic year|current.*school year|which academic year/i],
    answer: (ctx) => {
      const y = ctx.summary.activeAcademicYear
      if (!y) {
        return 'No academic year is currently marked as active. Set one under **Academic Years**.'
      }
      return `**Active academic year:** ${y.name}\n- Start: ${new Date(y.startDate).toLocaleDateString()}\n- End: ${new Date(y.endDate).toLocaleDateString()}`
    }
  },
  {
    id: 'attendance',
    patterns: [/attendance|absent|present.*month|late today/i],
    answer: (ctx) => {
      const a = ctx.attendanceThisMonth
      return `**Attendance (current month):**\n- Present: ${a.PRESENT || 0}\n- Absent: ${a.ABSENT || 0}\n- Late: ${a.LATE || 0}\n- Excused: ${a.EXCUSED || 0}\n- Total records: ${a.totalRecords || 0}`
    }
  },
  {
    id: 'unpaid_fees',
    patterns: [/unpaid|outstanding fee|pending fee|fees/i],
    answer: (ctx) => {
      const fees = ctx.unpaidFees || []
      if (!fees.length) {
        return `**Fees:** No outstanding (UNPAID/PARTIAL) fee records in the database.\n\nYou can add fee records in the database to track tuition payments.`
      }
      const total = fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
      return `**Unpaid fees (${fees.length} records):**\n\n${formatList(
        fees,
        (f) =>
          `- **${f.studentName}** (${f.className}) — ${f.label}: ${f.amount} (${f.status})`,
        ''
      )}\n\n**Estimated outstanding:** ${total.toFixed(2)}`
    }
  },
  {
    id: 'teachers_count',
    patterns: [/how many teachers|total teachers/i],
    answer: (ctx) => `**Total teachers:** ${ctx.summary.totalTeachers}`
  },
  {
    id: 'classes_count',
    patterns: [/how many classes|total classes/i],
    answer: (ctx) => `**Total classes:** ${ctx.summary.totalClasses}`
  },
  {
    id: 'users',
    patterns: [/how many users|total users|users by role/i],
    answer: (ctx) =>
      `**Total users:** ${ctx.summary.totalUsers}\n\n${formatList(
        ctx.usersByRole,
        (u) => `- ${u.role}: ${u.count}`,
        ''
      )}`
  },
  {
    id: 'parents',
    patterns: [/how many parents|total parents/i],
    answer: (ctx) => `**Total parents:** ${ctx.summary.totalParents}`
  },
  {
    id: 'years',
    patterns: [/academic year|school years/i],
    answer: (ctx) =>
      `**Academic years:**\n\n${formatList(
        ctx.academicYears,
        (y) =>
          `- **${y.name}**${y.isActive ? ' (ACTIVE)' : ''} — ${new Date(y.startDate).toLocaleDateString()} to ${new Date(y.endDate).toLocaleDateString()}`,
        'No academic years defined.'
      )}`
  },
  {
    id: 'overview',
    patterns: [/summary|overview|dashboard|school status|help/i],
    answer: (ctx) => {
      const s = ctx.summary
      return `**School overview**\n- Students: ${s.totalStudents}\n- Teachers: ${s.totalTeachers}\n- Parents: ${s.totalParents}\n- Classes: ${s.totalClasses}\n- Users: ${s.totalUsers}\n- Active year: ${s.activeAcademicYear?.name || 'None'}\n- Unpaid fee records: ${s.unpaidFeesCount}`
    }
  }
]

function scoreHandler(handler, message) {
  let score = 0
  for (const pattern of handler.patterns) {
    if (pattern.test(message)) score += 10
  }
  const words = message.toLowerCase().split(/\W+/).filter(Boolean)
  const keywords = {
    students_count: ['student', 'enrollment', 'registered', 'pupils'],
    teachers_list: ['teacher', 'faculty', 'staff'],
    students_per_class: ['class', 'room', 'grade'],
    active_year: ['year', 'active', 'academic'],
    attendance: ['attendance', 'absent', 'present', 'late'],
    unpaid_fees: ['fee', 'tuition', 'unpaid', 'payment'],
    users: ['user', 'account', 'admin'],
    parents: ['parent', 'guardian'],
    overview: ['help', 'hello', 'hi', 'start']
  }
  const keys = keywords[handler.id] || []
  for (const word of words) {
    if (keys.includes(word)) score += 2
  }
  return score
}

const { answerTeacher, answerParent, answerStudent } = require('./aiLocalRole.service')

function answerFromLocalData(message, context) {
  const q = String(message || '').trim()
  if (!q) {
    return 'Please enter a question about your school data.'
  }

  const role = context.role || 'ADMIN'
  if (role === 'TEACHER') return answerTeacher(q, context)
  if (role === 'PARENT') return answerParent(q, context)
  if (role === 'STUDENT') return answerStudent(q, context)

  const scored = handlers
    .map((h) => ({ handler: h, score: scoreHandler(h, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length >= 2 && scored[0].score === scored[1].score) {
    return scored.slice(0, 2).map((x) => x.handler.answer(context)).join('\n\n---\n\n')
  }

  if (scored.length > 0) {
    return scored[0].handler.answer(context)
  }

  return handlers.find((h) => h.id === 'overview').answer(context)
}

const { generateRoleLocalReport } = require('./aiLocalRole.service')
const {
  formatSchoolStudentsTimetableHtml,
  formatSchoolTeachersTimetableHtml
} = require('./aiTimetable.service')

function generateLocalReport(reportType, reportData) {
  const adminTypes = [
    'ATTENDANCE_MONTHLY',
    'STUDENT_ENROLLMENT',
    'TEACHER_WORKLOAD',
    'UNPAID_FEES',
    'TIMETABLE_STUDENTS',
    'TIMETABLE_TEACHERS'
  ]
  if (!adminTypes.includes(reportType)) {
    return generateRoleLocalReport(reportType, reportData)
  }

  const ctx = reportData.context
  const s = ctx.summary
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' })

  switch (reportType) {
    case 'ATTENDANCE_MONTHLY': {
      const a = ctx.attendanceThisMonth
      return `Monthly Attendance Report — ${month}

Executive Summary
This report summarizes attendance recorded in the system for the current calendar month.

Statistics
- Present: ${a.PRESENT || 0}
- Absent: ${a.ABSENT || 0}
- Late: ${a.LATE || 0}
- Excused: ${a.EXCUSED || 0}
- Total attendance records: ${a.totalRecords || 0}

Observations
${(a.ABSENT || 0) > (a.PRESENT || 0) ? 'Absences exceed present records in the sampled period; review follow-up with class teachers.' : 'Attendance patterns appear within normal operational range based on recorded data.'}

Recommendations
- Review students with repeated absences
- Share monthly summary with homeroom teachers
- Confirm all classes are recording daily attendance`
    }

    case 'STUDENT_ENROLLMENT':
      return `Student Enrollment Report — ${month}

Executive Summary
Total enrolled students: ${s.totalStudents} across ${s.totalClasses} classes.

Enrollment by Status
${formatList(ctx.enrollmentByStatus, (e) => `- ${e.status}: ${e.count}`, '- No data')}

Students per Class
${formatList(
  ctx.studentsPerClass,
  (c) => `- ${c.className}: ${c.studentCount} student(s)`,
  '- No classes'
)}

Recommendations
- Monitor classes approaching capacity
- Align new admissions with active academic year: ${s.activeAcademicYear?.name || 'not set'}`

    case 'TEACHER_WORKLOAD':
      return `Teacher Workload Report — ${month}

Executive Summary
Total teachers: ${s.totalTeachers}

Teacher Assignments
${formatList(
  ctx.teachers,
  (t) =>
    `- ${t.name}: ${t.classesCount} class(es), ${t.assignmentsCount} teaching assignment(s), specialty: ${t.subject || 'N/A'}`,
  '- No teachers'
)}

Recommendations
- Balance assignments where one teacher has significantly more classes than peers
- Document specialty coverage for secondary subjects`

    case 'UNPAID_FEES': {
      const fees = ctx.unpaidFees || []
      const total = fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
      return `Unpaid Fees Report — ${month}

Executive Summary
Outstanding fee records: ${fees.length}
Estimated total outstanding: ${total.toFixed(2)}

Affected Students
${formatList(
  fees,
  (f) => `- ${f.studentName} (${f.className}): ${f.label} — ${f.amount} (${f.status})`,
  'No unpaid fee records in the database.'
)}

Recommendations
- Contact families with overdue balances
- Offer payment plans for partial (PARTIAL) statuses
- Record new payments in the fee module when available`
    }

    case 'TIMETABLE_STUDENTS':
      return formatSchoolStudentsTimetableHtml(reportData.assignments || [], reportData.rooms || [])

    case 'TIMETABLE_TEACHERS':
      return formatSchoolTeachersTimetableHtml(reportData.assignments || [], reportData.rooms || [])

    default:
      return 'Report type not supported.'
  }
}

module.exports = { answerFromLocalData, generateLocalReport }
