const { AiReportType } = require('@prisma/client')
const prisma = require('../prisma')

const REPORT_TYPE_ALIASES = {
  TIMETABLE_STUDENTS: 'TIMETABLE',
  TIMETABLE_TEACHERS: 'TIMETABLE'
}

const TIMETABLE_REPORT_TYPES = new Set(['TIMETABLE', 'TIMETABLE_STUDENTS', 'TIMETABLE_TEACHERS'])

function toAiReportType(type) {
  const key = String(type || '').toUpperCase()
  const enumKey = REPORT_TYPE_ALIASES[key] || key
  const value = AiReportType[enumKey]
  if (!value) {
    const err = new Error(`Unsupported report type: ${type}`)
    err.status = 400
    throw err
  }
  return value
}
const { buildReportData } = require('./aiContext.service')
const { buildContextForUser, buildReportDataForRole } = require('./aiRoleContext.service')
const {
  createChatCompletion,
  isLlmConfigured,
  isOpenAiConfigured,
  getActiveProvider,
  isLlmRecoverableError,
  mapGeminiErrorMessage
} = require('./llm.service')
const { answerFromLocalData, generateLocalReport } = require('./aiLocal.service')
const { answerFromLocalGeneral } = require('./aiLocalGeneral.service')
const { answerFromGeneralKnowledge, buildHelpfulFallback } = require('./generalKnowledge.service')
const { getCapabilitiesForRole, isReportAllowedForRole } = require('../config/aiCapabilities')
const { detectIntent, isInsufficientSchoolAnswer } = require('./aiIntent.service')

const GENERAL_SYSTEM_PROMPT = `You are a helpful, professional general-purpose AI assistant.
Answer clearly and accurately. You are not accessing any private school database in this mode.
If the user mixes school and general topics, focus only on the general portion when told to do so.`

const SCHOOL_SYSTEM_BY_ROLE = {
  ADMIN: `You are the Admin School AI for EduManage. Answer using ONLY the school data JSON provided. Never invent student names, counts, or fees. If data is missing, say so clearly.`,
  TEACHER: `You are the Teacher School AI for EduManage. Use ONLY assigned classes and students from the JSON. Never reference other classes or students.`,
  PARENT: `You are the Parent School AI for EduManage. Use ONLY the linked children's data from the JSON. Never discuss other students.`,
  STUDENT: `You are the Student School AI for EduManage. Use ONLY the logged-in student's data from the JSON. Support learning without completing graded work for them.`
}

const MIXED_SYSTEM_PROMPT = `You combine two sources:
1) School data from the EduManage database (JSON + school answer draft) — use for enrollment, attendance, grades, classes, homework, fees, schedules.
2) General knowledge — use for non-school topics (science, coding, writing, etc.).
Clearly separate sections when both apply. Never invent school records not in the JSON.`

const ADMIN_REPORT_PROMPTS = {
  ATTENDANCE_MONTHLY: `Write a professional Monthly Attendance Report for school administrators.`,
  STUDENT_ENROLLMENT: `Write a professional Student Enrollment Report.`,
  TEACHER_WORKLOAD: `Write a professional Teacher Workload Report.`,
  UNPAID_FEES: `Write a professional Unpaid Fees Report.`,
  TIMETABLE: `Write a clear weekly school timetable for administrators, covering classes and teachers. Use Mon–Fri time slots and only data from the JSON.`
}

const REPORT_TITLES = {
  ATTENDANCE_MONTHLY: 'Monthly Attendance Report',
  STUDENT_ENROLLMENT: 'Student Enrollment Report',
  TEACHER_WORKLOAD: 'Teacher Workload Report',
  UNPAID_FEES: 'Unpaid Fees Report',
  LESSON_PLAN: 'Lesson Plan',
  CLASS_QUIZ: 'Class Quiz / Exam',
  CLASS_HOMEWORK: 'Homework Assignment',
  CLASS_PERFORMANCE: 'Class Performance Report',
  CHILD_PROGRESS: 'Child Academic Progress',
  CHILD_ATTENDANCE: 'Child Attendance Summary',
  STUDY_PLAN: 'Weekly Study Plan',
  REVISION_PLAN: 'Exam Revision Plan',
  TIMETABLE: 'Weekly Timetable',
  TIMETABLE_STUDENTS: 'Student Timetables',
  TIMETABLE_TEACHERS: 'Teacher Timetables'
}

function truncateTitle(text, max = 48) {
  const cleaned = String(text || 'New conversation').replace(/\s+/g, ' ').trim()
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max)}…`
}


function mapLlmError(error) {
  if (error.code === 'LLM_NOT_CONFIGURED' || error.code === 'OPENAI_NOT_CONFIGURED') {
    return { status: 503, message: mapGeminiErrorMessage(error.message) }
  }
  if (error.code === 'LLM_API_ERROR' || error.code === 'OPENAI_API_ERROR') {
    return {
      status: error.status === 429 ? 429 : 502,
      message: mapGeminiErrorMessage(error.message) || 'AI service error. Please try again later.'
    }
  }
  return { status: 500, message: mapGeminiErrorMessage(error.message) || 'AI service error.' }
}

async function tryLlmWithLocalFallback(llmFn, message) {
  try {
    return await llmFn()
  } catch (error) {
    if (isLlmRecoverableError(error)) {
      const local = await answerGeneralLocally(message)
      return `${local}\n\n---\n\n_Note: Full Gemini AI is unavailable (${mapGeminiErrorMessage(error.message)}). Using built-in answers._`
    }
    throw error
  }
}

async function answerGeneralLocally(message) {
  const local = answerFromLocalGeneral(message)
  if (local) return local

  const knowledge = await answerFromGeneralKnowledge(message)
  if (knowledge) return knowledge

  return buildHelpfulFallback(message)
}

async function getRecentMessages(sessionId, limit = 12) {
  const messages = await prisma.aiChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  return messages.reverse()
}

function historyToChatMessages(history) {
  return history.map((m) => ({
    role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
    content: m.content
  }))
}

async function callLlm(messages) {
  try {
    return await createChatCompletion(messages)
  } catch (error) {
    const mapped = mapLlmError(error)
    const err = new Error(mapped.message)
    err.status = mapped.status
    throw err
  }
}

async function answerWithGeneralAi(message, history) {
  return callLlm([
    { role: 'system', content: GENERAL_SYSTEM_PROMPT },
    ...historyToChatMessages(history),
    { role: 'user', content: message }
  ])
}

async function answerWithSchoolAi(message, context, role, history) {
  const system = SCHOOL_SYSTEM_BY_ROLE[role] || SCHOOL_SYSTEM_BY_ROLE.STUDENT

  if (await isLlmConfigured()) {
    return callLlm([
      { role: 'system', content: system },
      {
        role: 'system',
        content: `User role: ${role}. School data (JSON):\n${JSON.stringify(context, null, 2)}`
      },
      ...historyToChatMessages(history),
      { role: 'user', content: message }
    ])
  }

  return answerFromLocalData(message, context)
}

async function answerWithMixedAi(message, context, role, history, schoolDraft) {
  if (!(await isLlmConfigured())) {
    const schoolPart = schoolDraft || answerFromLocalData(message, context)
    const generalPart = await answerGeneralLocally(message)
    return `${schoolPart}\n\n---\n\n**General AI**\n\n${generalPart}`
  }

  return callLlm([
    { role: 'system', content: MIXED_SYSTEM_PROMPT },
    {
      role: 'system',
      content: `Role: ${role}. School data JSON:\n${JSON.stringify(context, null, 2)}`
    },
    {
      role: 'system',
      content: `Draft school-specific answer:\n${schoolDraft || '(none)'}`
    },
    ...historyToChatMessages(history),
    { role: 'user', content: message }
  ])
}

async function resolveChatResponse({ message, context, role, history }) {
  const intent = detectIntent(message, role)
  let source = 'school'

  if (intent === 'GENERAL') {
    source = 'general'
    if (!(await isLlmConfigured())) {
      return { content: await answerGeneralLocally(message), source }
    }
    const content = await tryLlmWithLocalFallback(
      () => answerWithGeneralAi(message, history),
      message
    )
    return { content, source }
  }

  if (intent === 'MIXED') {
    source = 'mixed'
    const schoolDraft = (await isLlmConfigured())
      ? await answerWithSchoolAi(message, context, role, history)
      : answerFromLocalData(message, context)
    const content = await answerWithMixedAi(message, context, role, history, schoolDraft)
    return { content, source }
  }

  let content = await answerWithSchoolAi(message, context, role, history)

  if (isInsufficientSchoolAnswer(content)) {
    source = 'general'
    if (await isLlmConfigured()) {
      content = await tryLlmWithLocalFallback(
        () =>
          callLlm([
            { role: 'system', content: GENERAL_SYSTEM_PROMPT },
            {
              role: 'system',
              content: `The user asked a school-related question but no matching records were found in their scoped data. Role: ${role}. Briefly note that, then answer helpfully from general knowledge if possible.`
            },
            ...historyToChatMessages(history),
            { role: 'user', content: message }
          ]),
        message
      )
    } else {
      content = `${content}\n\n---\n\n${await answerGeneralLocally(message)}`
    }
  }

  return { content, source }
}

async function sendChatMessage({ userId, userRole, sessionId, message }) {
  const trimmed = String(message || '').trim()
  const role = userRole || 'STUDENT'
  if (!trimmed) {
    const err = new Error('Message is required.')
    err.status = 400
    throw err
  }

  let session
  if (sessionId) {
    session = await prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId }
    })
    if (!session) {
      const err = new Error('Chat session not found.')
      err.status = 404
      throw err
    }
  } else {
    session = await prisma.aiChatSession.create({
      data: {
        userId,
        userRole: role,
        title: truncateTitle(trimmed)
      }
    })
  }

  await prisma.aiChatMessage.create({
    data: { sessionId: session.id, role: 'USER', content: trimmed }
  })

  const context = await buildContextForUser({ id: userId, role })
  const history = await getRecentMessages(session.id, 14)

  const { content: assistantContent, source } = await resolveChatResponse({
    message: trimmed,
    context,
    role,
    history
  })

  const assistantMessage = await prisma.aiChatMessage.create({
    data: {
      sessionId: session.id,
      role: 'ASSISTANT',
      content: assistantContent
    }
  })

  await prisma.aiChatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() }
  })

  return {
    session,
    userMessage: { role: 'USER', content: trimmed },
    assistantMessage,
    meta: { intent: detectIntent(trimmed, role), source }
  }
}

async function generateReport({ userId, userRole, reportType }) {
  const role = userRole || 'STUDENT'
  const type = String(reportType || '').toUpperCase()

  if (!isReportAllowedForRole(role, type)) {
    const err = new Error('This report type is not available for your role.')
    err.status = 403
    throw err
  }

  const reportData =
    role === 'ADMIN'
      ? await buildReportData(type)
      : await buildReportDataForRole(role, type, userId)

  let content
  if (TIMETABLE_REPORT_TYPES.has(type)) {
    content = generateLocalReport(type, reportData)
  } else if (await isLlmConfigured()) {
    const prompt =
      ADMIN_REPORT_PROMPTS[type] ||
      `Write a professional ${REPORT_TITLES[type] || 'school report'} for a ${role} user.`
    const system = SCHOOL_SYSTEM_BY_ROLE[role] || SCHOOL_SYSTEM_BY_ROLE.STUDENT
    try {
      content = await createChatCompletion([
        { role: 'system', content: system },
        {
          role: 'user',
          content: `${prompt}\n\nReport data (JSON):\n${JSON.stringify(reportData, null, 2)}`
        }
      ])
    } catch (error) {
      const mapped = mapLlmError(error)
      const err = new Error(mapped.message)
      err.status = mapped.status
      throw err
    }
  } else {
    content = generateLocalReport(type, reportData)
  }

  const report = await prisma.aiGeneratedReport.create({
    data: {
      userId,
      type: toAiReportType(type),
      title: REPORT_TITLES[type] || type,
      content
    }
  })

  if (type === 'TIMETABLE_STUDENTS' && TIMETABLE_REPORT_TYPES.has('TIMETABLE_TEACHERS')) {
    const teacherContent = generateLocalReport('TIMETABLE_TEACHERS', reportData)
    await prisma.aiGeneratedReport.create({
      data: {
        userId,
        type: toAiReportType('TIMETABLE_TEACHERS'),
        title: REPORT_TITLES.TIMETABLE_TEACHERS,
        content: teacherContent
      }
    })
  }

  return report
}

async function getDashboardStats(userId) {
  const [conversationCount, lastReport] = await Promise.all([
    prisma.aiChatSession.count({ where: { userId } }),
    prisma.aiGeneratedReport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, type: true, createdAt: true }
    })
  ])

  return { conversationCount, lastReport }
}

module.exports = {
  sendChatMessage,
  generateReport,
  getDashboardStats,
  getCapabilitiesForRole,
  isLlmConfigured,
  isOpenAiConfigured,
  getActiveProvider,
  detectIntent,
  REPORT_TITLES
}
