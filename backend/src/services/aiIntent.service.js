/**
 * Automatic intent detection: School AI vs General AI vs both.
 */

const SCHOOL_PATTERNS = [
  /\b(student|students|teacher|teachers|parent|parents|class|classes|grade|grades|attendance|absent|present|late|excused)\b/i,
  /\b(homework|assignment|assignments|exam|exams|quiz|quizzes|test scores?|report card)\b/i,
  /\b(fee|fees|tuition|unpaid|payment|enrollment|registered|academic year|school year)\b/i,
  /\b(schedule|timetable|timetable|course|courses|subject|subjects|classroom|room)\b/i,
  /\b(lesson plan|teaching assignment|my class|my classes|my child|my children|my grade|my grades)\b/i,
  /\b(how many|list all|show me|show my|total number|count of).*(student|teacher|class|user|parent)/i,
  /\b(school|edumanage|platform|dashboard|admin|workload|unpaid fees)\b/i,
  /\b(performing|progress|performance).*(child|student|month)/i,
  /\b(due this week|upcoming exam|revision plan|study plan)\b/i,
  /\b(generate|create|draft).*(quiz|homework|lesson)/i
]

const GENERAL_PATTERNS = [
  /\b(photosynthesis|javascript|python|java\b|html|css|react|node\.?js)\b/i,
  /\b(write (a |an |me )?(professional )?email|cover letter|resume|cv)\b/i,
  /\b(explain (?!my |the class)|what is|who was|tell me about|define )\b/i,
  /\b(help me learn|teach me|how to code|programming|recipe|cook)\b/i,
  /\b(weather|news|movie|song|poem|story|joke|translate)\b/i,
  /\b(math problem|solve for|equation)(?!.*class|.*grade|.*student)/i,
  /\b(history of|capital of|country|president)\b/i,
  /\b(grammar|spelling|synonym|essay about)(?!.*student|.*class|.*school)/i
]

const MIXED_SIGNALS = [
  /\band also\b/i,
  /\balso explain\b/i,
  /\bplus\b.*\b(explain|write|help)\b/i,
  /\bmy (grades|attendance).*\band\b/i
]

function scorePatterns(text, patterns) {
  let score = 0
  for (const pattern of patterns) {
    if (pattern.test(text)) score += 1
  }
  return score
}

const ROLE_SCHOOL_BOOST = {
  STUDENT: [
    /\b(my|mine)\b/i,
    /\b(homework|grades?|schedule|class|revision|exam|due)\b/i,
    /\bhelp me understand\b/i,
    /\bstudy plan\b/i
  ],
  PARENT: [/\b(my child|my children|child's|children's)\b/i, /\b(homework|attendance|grades?|exam)\b/i],
  TEACHER: [/\b(my class|assigned|students? in|lesson plan|quiz|homework)\b/i],
  ADMIN: [/\b(school|students? registered|teachers?|classes|fees|enrollment|academic year)\b/i]
}

/**
 * @returns {'SCHOOL' | 'GENERAL' | 'MIXED'}
 */
function detectIntent(message, role) {
  const text = String(message || '').trim()
  if (!text) return 'GENERAL'

  const lower = text.toLowerCase()

  let schoolScore = scorePatterns(text, SCHOOL_PATTERNS)
  let generalScore = scorePatterns(text, GENERAL_PATTERNS)

  const schoolWords = [
    'student', 'teacher', 'class', 'grade', 'attendance', 'homework', 'exam', 'fee',
    'schedule', 'enrollment', 'quiz', 'lesson', 'child', 'children', 'school', 'course',
    'subject', 'assignment', 'registered', 'absent', 'timetable', 'tuition', 'parent'
  ]
  const generalWords = [
    'photosynthesis', 'javascript', 'email', 'python', 'recipe', 'weather', 'poem',
    'translate', 'grammar', 'capital', 'history of', 'write me', 'explain how'
  ]

  for (const w of schoolWords) {
    if (lower.includes(w)) schoolScore += 0.5
  }
  for (const w of generalWords) {
    if (lower.includes(w)) generalScore += 0.5
  }

  const roleBoosts = ROLE_SCHOOL_BOOST[role] || []
  for (const pattern of roleBoosts) {
    if (pattern.test(text)) schoolScore += 1
  }

  if (MIXED_SIGNALS.some((p) => p.test(text)) && schoolScore > 0 && generalScore > 0) {
    return 'MIXED'
  }

  if (schoolScore >= 1.5 && generalScore >= 1.5) return 'MIXED'
  if (schoolScore >= 1 && generalScore < 1) return 'SCHOOL'
  if (generalScore >= 1 && schoolScore < 0.5) return 'GENERAL'

  if (schoolScore > generalScore && schoolScore >= 0.5) return 'SCHOOL'
  if (generalScore > schoolScore && generalScore >= 0.5) return 'GENERAL'

  return schoolScore > 0 ? 'SCHOOL' : 'GENERAL'
}

const INSUFFICIENT_SCHOOL_PATTERNS = [
  /try asking/i,
  /try:\s*\n/i,
  /\*\*Teacher assistant\*\*/i,
  /\*\*Parent assistant\*\*/i,
  /\*\*Student assistant\*\*/i,
  /I can answer questions about your school/i,
  /No teacher profile is linked/i,
  /No children are linked/i,
  /No student profile is linked/i,
  /local database mode/i,
  /Add `OPENAI_API_KEY`/i
]

function isInsufficientSchoolAnswer(text) {
  const t = String(text || '')
  if (t.length < 20) return false
  return INSUFFICIENT_SCHOOL_PATTERNS.some((p) => p.test(t))
}

module.exports = { detectIntent, isInsufficientSchoolAnswer }
