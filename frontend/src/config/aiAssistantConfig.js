/** Fallback UI config when API capabilities are not loaded yet. */
export const AI_ASSISTANT_FALLBACK = {
  ADMIN: {
    title: 'Admin AI Assistant',
    subtitle: 'School data from your database, plus general AI for any other topic — detected automatically.',
    prompts: [
      'How many students are registered?',
      'List all teachers.',
      'Show attendance statistics for this month.',
      'Explain photosynthesis.',
      'Write a professional email to parents.',
      'Help me learn JavaScript.'
    ],
    reports: [
      { type: 'ATTENDANCE_MONTHLY', label: 'Monthly Attendance Report', description: 'School-wide attendance for this month.' },
      { type: 'STUDENT_ENROLLMENT', label: 'Student Enrollment Report', description: 'Enrollment totals and class distribution.' },
      { type: 'TEACHER_WORKLOAD', label: 'Teacher Workload Report', description: 'Classes and assignments per teacher.' },
      { type: 'UNPAID_FEES', label: 'Unpaid Fees Report', description: 'Outstanding fee balances.' }
    ]
  },
  TEACHER: {
    title: 'Teacher AI Assistant',
    subtitle: 'Your classes and students from the database, plus general teaching help — automatic.',
    prompts: [
      'What classes am I assigned to?',
      'Show attendance for my classes this month.',
      'Generate a mathematics quiz for Grade 7.',
      'Create a lesson plan about fractions.',
      'Explain photosynthesis for a science class.',
      'Write feedback comments for a student report.'
    ],
    reports: [
      { type: 'LESSON_PLAN', label: 'Lesson Plan', description: 'Structured lesson plan for your class.' },
      { type: 'CLASS_QUIZ', label: 'Quiz / Exam', description: 'Quiz questions for a topic and grade level.' },
      { type: 'CLASS_HOMEWORK', label: 'Homework Assignment', description: 'Homework task outline for students.' },
      { type: 'CLASS_PERFORMANCE', label: 'Class Performance', description: 'Grades and attendance for your classes.' }
    ]
  },
  PARENT: {
    title: 'Parent AI Assistant',
    subtitle: 'Your children’s school data only, plus general parenting and learning tips.',
    prompts: [
      'How is my child performing this month?',
      "Show my children's attendance.",
      'What homework is due for my children?',
      'How can I support my child with studying?',
      'Explain photosynthesis simply.',
      'Write a polite email to a teacher.'
    ],
    reports: [
      { type: 'CHILD_PROGRESS', label: 'Academic Progress', description: 'Grades and performance for your children.' },
      { type: 'CHILD_ATTENDANCE', label: 'Attendance Summary', description: 'Attendance patterns for your children.' }
    ]
  },
  STUDENT: {
    title: 'Student AI Assistant',
    subtitle: 'Your grades, homework, and schedule from school data, plus general study help.',
    prompts: [
      'What homework is due this week?',
      'Show my recent grades.',
      'Create a revision plan for my upcoming exams.',
      'Help me understand fractions.',
      'Explain photosynthesis.',
      'What is the difference between DNA and RNA?'
    ],
    reports: [
      { type: 'STUDY_PLAN', label: 'Study Plan', description: 'Weekly study plan from your workload.' },
      { type: 'REVISION_PLAN', label: 'Revision Plan', description: 'Exam revision plan from upcoming deadlines.' }
    ]
  }
}

export function getFallbackCapabilities(role) {
  return AI_ASSISTANT_FALLBACK[role] || AI_ASSISTANT_FALLBACK.STUDENT
}
