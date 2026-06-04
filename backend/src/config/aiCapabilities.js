const REPORTS_BY_ROLE = {
  ADMIN: [
    { type: 'ATTENDANCE_MONTHLY', label: 'Monthly Attendance Report', description: 'School-wide attendance for this month.' },
    { type: 'STUDENT_ENROLLMENT', label: 'Student Enrollment Report', description: 'Enrollment totals and class distribution.' },
    { type: 'TEACHER_WORKLOAD', label: 'Teacher Workload Report', description: 'Classes and assignments per teacher.' },
    { type: 'UNPAID_FEES', label: 'Unpaid Fees Report', description: 'Outstanding fee balances.' }
  ],
  TEACHER: [
    { type: 'LESSON_PLAN', label: 'Lesson Plan', description: 'Structured lesson plan for your class.' },
    { type: 'CLASS_QUIZ', label: 'Quiz / Exam', description: 'Quiz questions for a topic and grade level.' },
    { type: 'CLASS_HOMEWORK', label: 'Homework Assignment', description: 'Homework task outline for students.' },
    { type: 'CLASS_PERFORMANCE', label: 'Class Performance', description: 'Grades and attendance for your classes.' }
  ],
  PARENT: [
    { type: 'CHILD_PROGRESS', label: 'Academic Progress', description: 'Grades and performance for your children.' },
    { type: 'CHILD_ATTENDANCE', label: 'Attendance Summary', description: 'Attendance patterns for your children.' }
  ],
  STUDENT: [
    { type: 'STUDY_PLAN', label: 'Study Plan', description: 'Weekly study plan from your workload.' },
    { type: 'REVISION_PLAN', label: 'Revision Plan', description: 'Exam revision plan from upcoming deadlines.' }
  ]
}

const PROMPTS_BY_ROLE = {
  ADMIN: [
    'How many students are registered?',
    'List all teachers.',
    'Show attendance statistics for this month.',
    'Explain photosynthesis.',
    'Write a professional email to parents.',
    'Help me learn JavaScript.'
  ],
  TEACHER: [
    'What classes am I assigned to?',
    'Show attendance for my classes this month.',
    'Generate a mathematics quiz for Grade 7.',
    'Create a lesson plan about fractions.',
    'Explain photosynthesis for a science class.',
    'Write feedback comments for a student report.'
  ],
  PARENT: [
    'How is my child performing this month?',
    "Show my children's attendance.",
    'What homework is due for my children?',
    'How can I support my child with studying?',
    'Explain photosynthesis simply.',
    'Write a polite email to a teacher.'
  ],
  STUDENT: [
    'What homework is due this week?',
    'Show my recent grades.',
    'Create a revision plan for my upcoming exams.',
    'Help me understand fractions.',
    'Explain photosynthesis.',
    'What is the difference between DNA and RNA?'
  ]
}

const TITLES_BY_ROLE = {
  ADMIN: {
    title: 'Admin AI Assistant',
    subtitle: 'School data from your database, plus general AI for any other topic — detected automatically.'
  },
  TEACHER: {
    title: 'Teacher AI Assistant',
    subtitle: 'Your classes and students from the database, plus general teaching help — automatic.'
  },
  PARENT: {
    title: 'Parent AI Assistant',
    subtitle: 'Your children’s school data only, plus general parenting and learning tips.'
  },
  STUDENT: {
    title: 'Student AI Assistant',
    subtitle: 'Your grades, homework, and schedule from school data, plus general study help.'
  }
}

function getCapabilitiesForRole(role) {
  const key = REPORTS_BY_ROLE[role] ? role : 'STUDENT'
  return {
    role: key,
    ...TITLES_BY_ROLE[key],
    prompts: PROMPTS_BY_ROLE[key],
    reports: REPORTS_BY_ROLE[key] || []
  }
}

function isReportAllowedForRole(role, reportType) {
  const type = String(reportType || '').toUpperCase()
  return (REPORTS_BY_ROLE[role] || []).some((r) => r.type === type)
}

module.exports = { getCapabilitiesForRole, isReportAllowedForRole, REPORTS_BY_ROLE }
