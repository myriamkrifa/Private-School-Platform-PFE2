function formatList(items, formatter, empty = 'None recorded.') {
  if (!items?.length) return empty
  return items.map(formatter).join('\n')
}

function extractTopic(message) {
  const m = String(message || '')
  const about = m.match(/about\s+(.+?)(?:\s+for|\s+in|$)/i)
  if (about) return about[1].trim()
  const forGrade = m.match(/(?:quiz|homework|lesson|plan)\s+(?:on|for)?\s*(.+)/i)
  if (forGrade) return forGrade[1].trim()
  return 'the requested topic'
}

function extractGrade(message, fallback) {
  const m = String(message || '')
  const g = m.match(/grade\s*(\d+|[a-z0-9\s]+)/i)
  return g ? g[1].trim() : fallback || 'your class level'
}

// ─── TEACHER ─────────────────────────────────────────────

function answerTeacher(message, ctx) {
  const q = message.toLowerCase()
  if (!ctx.profile) {
    return 'No teacher profile is linked to your account. Contact an administrator.'
  }

  if (/assigned class|my classes|what classes/.test(q)) {
    return `**Your assigned classes:**\n\n${formatList(
      ctx.assignedClasses,
      (c) =>
        `- **${c.name}** (${c.level}) — ${c.courses?.map((co) => co.title).join(', ') || 'No subjects listed'}`,
      'No class assignments found.'
    )}`
  }

  if (/list students|students in my|my students/.test(q)) {
    return `**Students in your classes (${ctx.studentCount}):**\n\n${formatList(
      ctx.students,
      (s) => `- **${s.name}** — ${s.class?.name || 'Class'}, grade label: ${s.grade}`,
      'No students in your assigned classes.'
    )}`
  }

  if (/attendance/.test(q)) {
    const a = ctx.attendanceThisMonth
    return `**Attendance for your classes (this month):**\n- Present: ${a.PRESENT || 0}\n- Absent: ${a.ABSENT || 0}\n- Late: ${a.LATE || 0}\n- Excused: ${a.EXCUSED || 0}\n- Records: ${a.totalRecords || 0}`
  }

  if (/lesson plan|create a lesson/.test(q)) {
    const topic = extractTopic(message)
    const grade = extractGrade(message, ctx.assignedClasses[0]?.name)
    return `**Lesson Plan: ${topic}**\n(${grade})\n\n**Objectives**\n- Students understand core concepts of ${topic}\n- Students can apply ${topic} in guided exercises\n\n**Introduction (10 min)**\n- Recall prior knowledge\n- Present learning goals\n\n**Instruction (25 min)**\n- Explain ${topic} with examples\n- Demonstrate step-by-step solutions\n\n**Practice (15 min)**\n- Paired exercises on ${topic}\n- Teacher circulates and supports\n\n**Assessment (10 min)**\n- Short exit ticket (3 questions)\n\n**Homework**\n- Practice sheet on ${topic}`
  }

  if (/quiz|exam|test/.test(q)) {
    const topic = extractTopic(message)
    const grade = extractGrade(message, 'Grade 7')
    return `**${topic} — Quiz (${grade})**\n\n1. Define key vocabulary for ${topic}.\n2. Solve: basic problem using ${topic}.\n3. Application word problem.\n4. Compare two methods related to ${topic}.\n5. Short answer: explain when to use ${topic}.\n\n**Answer key:** Provide in class after submission.`
  }

  if (/homework|assignment/.test(q)) {
    const topic = extractTopic(message)
    return `**Homework: ${topic}**\n\n- Read class notes on ${topic}\n- Complete exercises 1–8\n- Write a short reflection (5 sentences) on one challenge you faced\n- Due: next class session`
  }

  if (/performance|grades|report comment|comments for/.test(q)) {
    const grades = ctx.recentGrades || []
    if (!grades.length) {
      return 'No recent grades recorded for students in your classes.'
    }
    return `**Recent performance (sample):**\n\n${formatList(
      grades.slice(0, 10),
      (g) =>
        `- **${g.student?.name}** — ${g.course?.title || g.subject}: ${g.score}/${g.maxScore}`,
      ''
    )}\n\n**Report comment template:** Shows steady effort; encourage practice in weaker areas and celebrate improvement.`
  }

  return `**Teacher assistant** — I can help with:\n- Assigned classes and students\n- Attendance for your classes\n- Lesson plans, quizzes, and homework drafts\n- Class performance summary\n\nTry: "Show attendance for my classes this month" or "Generate a mathematics quiz for Grade 7."`
}

// ─── PARENT ─────────────────────────────────────────────

function answerParent(message, ctx) {
  const q = message.toLowerCase()
  if (!ctx.children?.length) {
    return 'No children are linked to your parent account. Contact the school administrator.'
  }

  if (/perform|progress|grades|how is my child/.test(q)) {
    return ctx.children
      .map((child) => {
        const grades = child.recentGrades || []
        const avg =
          grades.length > 0
            ? (
                grades.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) / grades.length
              ).toFixed(1)
            : 'N/A'
        return `**${child.name}** (${child.className})\n- Recent grades: ${grades.length}\n- Approx. average: ${avg}%\n${formatList(
          grades.slice(0, 5),
          (g) => `  - ${g.course || g.subject}: ${g.score}/${g.maxScore}`,
          '  - No grades yet'
        )}`
      })
      .join('\n\n')
  }

  if (/attendance/.test(q)) {
    return ctx.children
      .map((child) => {
        const att = child.recentAttendance || []
        const absent = att.filter((a) => a.status === 'ABSENT' || a.status === 'LATE').length
        return `**${child.name}**\n- Recent attendance records: ${att.length}\n- Absences/lates in sample: ${absent}\n${formatList(
          att.slice(0, 5),
          (a) => `  - ${new Date(a.date).toLocaleDateString()}: ${a.status}${a.course ? ` (${a.course})` : ''}`,
          '  - No attendance records'
        )}`
      })
      .join('\n\n')
  }

  if (/homework|due/.test(q)) {
    const items = ctx.upcomingAssignments || []
    if (!items.length) {
      return 'No upcoming homework deadlines found for your children.'
    }
    return `**Upcoming homework & assignments:**\n\n${formatList(
      items,
      (a) =>
        `- **${a.title}** — due ${new Date(a.dueDate).toLocaleDateString()} (${a.className || 'Class'}, ${a.course || 'Subject'})`,
      ''
    )}`
  }

  if (/exam|upcoming|coming up/.test(q)) {
    const items = ctx.upcomingAssignments || []
    if (!items.length) {
      return 'No upcoming exams or major assignments in the system for your children.'
    }
    return `**Upcoming for your children:**\n\n${formatList(
      items,
      (a) => `- ${a.title} — ${new Date(a.dueDate).toLocaleDateString()}`,
      ''
    )}`
  }

  if (/support|help my child|recommend/.test(q)) {
    return `**Tips to support your child:**\n- Review recent grades together and set one weekly goal\n- Maintain a consistent homework routine\n- Contact teachers if absences exceed 3 days this month\n- Use short practice sessions (20–25 min) for weak subjects\n\nAsk: "How is my child performing?" or "Show my children's attendance."`
  }

  const names = ctx.children.map((c) => c.name).join(', ')
  return `**Parent assistant** — You can view data only for your children: **${names}**.\n\nTry:\n- How is my child performing this month?\n- Show my children's attendance\n- What homework is due for my children?`
}

// ─── STUDENT ─────────────────────────────────────────────

function answerStudent(message, ctx) {
  const q = message.toLowerCase()
  if (!ctx.profile) {
    return 'No student profile is linked to your account. Contact your school administrator.'
  }

  if (/homework|due/.test(q)) {
    const items = ctx.upcomingAssignments || []
    if (!items.length) {
      return 'No homework due this week in the system. Check with your teacher for updates.'
    }
    return `**Homework due soon:**\n\n${formatList(
      items,
      (a) =>
        `- **${a.title}** — ${new Date(a.dueDate).toLocaleDateString()} (${a.course || 'Subject'})${a.description ? `\n  ${a.description.slice(0, 120)}` : ''}`,
      ''
    )}`
  }

  if (/schedule|timetable|subjects|my class/.test(q)) {
    return `**Your class:** ${ctx.profile.className || 'Not assigned'} (${ctx.profile.room || 'room TBA'})\n\n**Subjects:**\n${formatList(
      ctx.subjects,
      (s) => `- ${s.title}${s.teacherName ? ` — ${s.teacherName}` : ''}`,
      'No subjects listed for your class.'
    )}`
  }

  if (/grades|scores|results/.test(q)) {
    const grades = ctx.grades || []
    if (!grades.length) {
      return 'No grades recorded yet.'
    }
    return `**Your recent grades:**\n\n${formatList(
      grades.slice(0, 12),
      (g) =>
        `- ${g.course || g.subject}: **${g.score}/${g.maxScore}** (${g.type || 'assessment'}) — ${new Date(g.recordedAt).toLocaleDateString()}`,
      ''
    )}`
  }

  if (/understand|explain|help me|fraction|study/.test(q)) {
    const topic = extractTopic(message)
    return `**Study help: ${topic}**\n\n1. **Definition** — Write the definition in your own words.\n2. **Example** — Work one solved example from your notes.\n3. **Practice** — Try 3 problems without looking at answers.\n4. **Check** — Compare with textbook or ask your teacher.\n5. **Review** — Revisit after 24 hours for better retention.\n\n*Only use your class materials; ask your teacher for official exam guidance.*`
  }

  if (/revision|exam plan|study plan/.test(q)) {
    const items = ctx.upcomingAssignments || []
    return `**Revision plan**\n\n**This week**\n${formatList(
      items.slice(0, 5),
      (a, i) => `Day ${i + 1}: Review for **${a.title}** (${a.course || 'subject'}) — due ${new Date(a.dueDate).toLocaleDateString()}`,
      '- No deadlines — review last 3 subjects for 30 min each day'
    )}\n\n**Daily routine:** 25 min review → 10 min break → 15 min practice questions.`
  }

  if (/attendance/.test(q)) {
    const att = ctx.attendanceThisMonth || []
    return `**Your attendance this month (${att.length} records):**\n\n${formatList(
      att.slice(0, 10),
      (a) => `- ${new Date(a.date).toLocaleDateString()}: ${a.status}${a.course ? ` (${a.course})` : ''}`,
      'No attendance records this month.'
    )}`
  }

  return `**Student assistant** — Ask about:\n- Homework due this week\n- Your schedule and subjects\n- Recent grades\n- Study help on a topic\n- Revision plans\n\nExample: "What homework is due this week?"`
}

function generateRoleLocalReport(reportType, reportData) {
  const ctx = reportData.context
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' })

  switch (reportType) {
    case 'LESSON_PLAN':
      return `Lesson Plan — ${month}\n\nBased on your assigned classes, prepare differentiated instruction for your courses.\n\nSuggested structure: objectives → introduction → guided practice → assessment → homework.\n\nUse the chat to request: "Create a lesson plan about [topic] for [class]."`
    case 'CLASS_QUIZ':
      return `Quiz Template — ${month}\n\nGenerate topic-specific quizzes via chat, e.g. "Generate a mathematics quiz for Grade 7."\n\nInclude: knowledge, application, and one challenge question per quiz.`
    case 'CLASS_HOMEWORK':
      return `Homework Outline — ${month}\n\nDraft homework via chat with the topic and class, e.g. "Draft homework about linear equations."\n\nAlign due dates with your assignment calendar in the platform.`
    case 'CLASS_PERFORMANCE': {
      const grades = ctx.recentGrades || []
      return `Class Performance Report — ${month}\n\nTeacher: ${ctx.profile?.name}\nClasses: ${ctx.assignedClasses?.map((c) => c.name).join(', ') || 'N/A'}\nStudents: ${ctx.studentCount}\n\nAttendance (month): ${JSON.stringify(ctx.attendanceThisMonth)}\n\nRecent grades (${grades.length}):\n${formatList(
        grades.slice(0, 15),
        (g) => `- ${g.student?.name}: ${g.score}/${g.maxScore} (${g.course?.title || g.subject})`,
        'No grades'
      )}`
    }
    case 'CHILD_PROGRESS':
      return `Academic Progress — ${month}\n\n${formatList(
        ctx.children,
        (c) => {
          const g = c.recentGrades || []
          return `**${c.name}** (${c.className})\nGrades on file: ${g.length}\n${formatList(g.slice(0, 5), (x) => `  - ${x.course || x.subject}: ${x.score}/${x.maxScore}`, '  - None')}`
        },
        'No children linked.'
      )}`
    case 'CHILD_ATTENDANCE':
      return `Attendance Summary — ${month}\n\n${formatList(
        ctx.children,
        (c) => {
          const att = c.recentAttendance || []
          return `**${c.name}**: ${att.length} recent records\n${formatList(att.slice(0, 5), (a) => `  - ${new Date(a.date).toLocaleDateString()}: ${a.status}`, '  - None')}`
        },
        'No children linked.'
      )}`
    case 'STUDY_PLAN':
      return `Weekly Study Plan — ${ctx.profile?.name || 'Student'}\n\n${formatList(
        ctx.upcomingAssignments?.slice(0, 7),
        (a, i) => `Day ${i + 1}: ${a.title} (${a.course}) — prepare before ${new Date(a.dueDate).toLocaleDateString()}`,
        'No assignments — review each subject 30 minutes daily.'
      )}`
    case 'REVISION_PLAN':
      return `Revision Plan — ${ctx.profile?.name || 'Student'}\n\nUpcoming deadlines:\n${formatList(
        ctx.upcomingAssignments,
        (a) => `- ${a.title}: ${new Date(a.dueDate).toLocaleDateString()}`,
        'None — revise last 3 subjects.'
      )}\n\nBlock 45 min per subject; use past papers where available.`
    default:
      return 'Report generated from your available school data.'
  }
}

module.exports = {
  answerTeacher,
  answerParent,
  answerStudent,
  generateRoleLocalReport
}
