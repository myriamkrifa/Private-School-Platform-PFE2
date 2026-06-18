const prisma = require('../prisma')

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// Teaching periods only (Mon–Fri, 08:00–17:00 school day).
const TIME_SLOTS = [
  { period: 1, time: '08:00 – 09:00' },
  { period: 2, time: '09:15 – 10:15' },
  { period: 3, time: '10:30 – 11:30' },
  { period: 4, time: '11:45 – 12:45' },
  { period: 5, time: '13:45 – 14:45' },
  { period: 6, time: '15:00 – 16:00' },
  { period: 7, time: '16:15 – 17:00' }
]

// Break rows inserted in chronological order while rendering the grid.
const DAY_BREAKS = [
  { afterPeriod: 3, time: '11:30 – 11:45', label: 'Break' },
  { afterPeriod: 4, time: '12:45 – 13:45', label: 'Lunch' },
  { afterPeriod: 6, time: '16:00 – 16:15', label: 'Break' }
]

async function fetchTeachingAssignments() {
  return prisma.teachingAssignment.findMany({
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      class: { select: { id: true, name: true, room: true, level: true } },
      course: { select: { id: true, title: true, code: true, coefficient: true } }
    },
    orderBy: [{ classId: 'asc' }, { teacherId: 'asc' }, { courseId: 'asc' }]
  })
}

async function fetchRooms() {
  return prisma.room.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, capacity: true, building: true }
  })
}

function buildPlacementRoomMap(allAssignments = [], slotMap = new Map(), rooms = []) {
  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name))
  if (!sortedRooms.length) return new Map()

  const placementRoomMap = new Map()
  const roomBusy = new Set()
  const placementsByClass = new Map()

  allAssignments.forEach((assignment) => {
    const classId = assignment.class?.id
    if (!classId) return

    for (let instance = 0; instance < WEEK_DAYS.length; instance += 1) {
      const key = slotPlacementKey(assignment.id, instance)
      const placement = slotMap.get(key)
      if (!placement) break

      if (!placementsByClass.has(classId)) placementsByClass.set(classId, [])
      placementsByClass.get(classId).push({
        key,
        dayIndex: placement.dayIndex,
        slotIndex: placement.slotIndex
      })
    }
  })

  placementsByClass.forEach((placements) => {
    placements.sort((a, b) => a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex)

    placements.forEach((placement, index) => {
      const slotKey = `${placement.dayIndex}-${placement.slotIndex}`
      let chosen = null

      for (let attempt = 0; attempt < sortedRooms.length; attempt += 1) {
        const roomIndex = (index + attempt) % sortedRooms.length
        const candidate = sortedRooms[roomIndex].name
        const busyKey = `${slotKey}::${candidate}`
        if (!roomBusy.has(busyKey)) {
          chosen = candidate
          roomBusy.add(busyKey)
          break
        }
      }

      if (!chosen) {
        chosen = sortedRooms[index % sortedRooms.length].name
      }

      placementRoomMap.set(placement.key, chosen)
    })
  })

  return placementRoomMap
}

function createSchedulingPlan(allAssignments = [], rooms = []) {
  const slotMap = buildGlobalSlotMap(allAssignments)
  const placementRoomMap = rooms.length
    ? buildPlacementRoomMap(allAssignments, slotMap, rooms)
    : null
  return { slotMap, placementRoomMap, rooms }
}

async function prepareAssignmentsWithAutoRooms() {
  const [assignments, rooms] = await Promise.all([fetchTeachingAssignments(), fetchRooms()])
  return { assignments, rooms }
}

function roomsUsedInSchedule(schedule = []) {
  return [
    ...new Set(
      schedule.flatMap((dayRow) =>
        dayRow.slots.map((slot) => slot.session?.room).filter(Boolean)
      )
    )
  ]
}

function buildAssignmentSession(assignment, roomOverride = null) {
  return {
    subject: assignment.course?.title || 'Subject',
    subjectCode: assignment.course?.code || null,
    className: assignment.class?.name || null,
    room: roomOverride || assignment.class?.room || null,
    teacherName: assignment.teacher?.name || null,
    level: assignment.class?.level || null
  }
}

function createEmptySchedule() {
  return WEEK_DAYS.map((day) => ({
    day,
    slots: TIME_SLOTS.map((slot) => ({ ...slot, session: null }))
  }))
}

function groupAssignmentsByClass(assignments = []) {
  const byClass = new Map()
  assignments.forEach((row) => {
    const key = row.class?.id || 'unassigned'
    if (!byClass.has(key)) byClass.set(key, { class: row.class, rows: [] })
    byClass.get(key).rows.push(row)
  })
  return byClass
}

function sessionsPerWeekForAssignment(assignment) {
  const coefficient = Number(assignment.course?.coefficient)
  const weeklySessions = Number.isFinite(coefficient) && coefficient > 0
    ? Math.round(coefficient)
    : 3
  // At most one session per weekday for the same subject.
  return Math.min(WEEK_DAYS.length, Math.max(1, weeklySessions))
}

function rotateAssignments(assignments, dayIndex) {
  if (!assignments.length) return []
  const offset = dayIndex % assignments.length
  return [...assignments.slice(offset), ...assignments.slice(0, offset)]
}

function pickAssignmentForSlot(assignments, dayIndex, slotKey, usedCoursesToday, remaining, placedCount, teacherBusy) {
  const candidates = rotateAssignments(assignments, dayIndex).filter((assignment) => {
    const courseId = assignment.course?.id
    if (courseId != null && usedCoursesToday.has(courseId)) return false
    const teacherId = assignment.teacher?.id
    if (teacherId && teacherBusy.has(`${teacherId}-${slotKey}`)) return false
    return true
  })

  if (!candidates.length) return null

  const withWeeklyQuota = candidates.filter((assignment) => remaining.get(assignment.id) > 0)
  const pool = withWeeklyQuota.length ? withWeeklyQuota : candidates

  return pool.sort((a, b) => {
    const remainingDiff = remaining.get(b.id) - remaining.get(a.id)
    if (remainingDiff !== 0) return remainingDiff
    return placedCount.get(a.id) - placedCount.get(b.id)
  })[0]
}

function buildClassSlotMap(assignments, teacherBusy) {
  const slotMap = new Map()
  const instances = new Map(assignments.map((assignment) => [assignment.id, 0]))
  const remaining = new Map(
    assignments.map((assignment) => [assignment.id, sessionsPerWeekForAssignment(assignment)])
  )
  const placedCount = new Map(assignments.map((assignment) => [assignment.id, 0]))

  for (let dayIndex = 0; dayIndex < WEEK_DAYS.length; dayIndex += 1) {
    const usedCoursesToday = new Set()

    for (let slotIndex = 0; slotIndex < TIME_SLOTS.length; slotIndex += 1) {
      const slotKey = `${dayIndex}-${slotIndex}`
      const assignment = pickAssignmentForSlot(
        assignments,
        dayIndex,
        slotKey,
        usedCoursesToday,
        remaining,
        placedCount,
        teacherBusy
      )

      if (!assignment) continue

      const instance = instances.get(assignment.id)
      slotMap.set(slotPlacementKey(assignment.id, instance), { dayIndex, slotIndex })
      instances.set(assignment.id, instance + 1)
      placedCount.set(assignment.id, placedCount.get(assignment.id) + 1)
      if (remaining.get(assignment.id) > 0) {
        remaining.set(assignment.id, remaining.get(assignment.id) - 1)
      }

      const courseId = assignment.course?.id
      if (courseId != null) usedCoursesToday.add(courseId)

      const teacherId = assignment.teacher?.id
      if (teacherId) teacherBusy.add(`${teacherId}-${slotKey}`)
    }
  }

  return slotMap
}

function slotPlacementKey(assignmentId, instance) {
  return `${assignmentId}:${instance}`
}

function buildGlobalSlotMap(assignments = []) {
  const byClass = groupAssignmentsByClass(assignments)
  const slotMap = new Map()
  const teacherBusy = new Set()

  byClass.forEach(({ rows }) => {
    const classSlots = buildClassSlotMap(rows, teacherBusy)
    classSlots.forEach((slot, key) => slotMap.set(key, slot))
  })

  return slotMap
}

function applyAssignmentsToSchedule(schedule, assignments, slotMap, placementRoomMap = null) {
  assignments.forEach((assignment) => {
    for (let instance = 0; instance < WEEK_DAYS.length; instance += 1) {
      const placementKey = slotPlacementKey(assignment.id, instance)
      const placement = slotMap.get(placementKey)
      if (!placement) break
      const room = placementRoomMap?.get(placementKey) || assignment.class?.room || null
      schedule[placement.dayIndex].slots[placement.slotIndex].session = buildAssignmentSession(
        assignment,
        room
      )
    }
  })
  return schedule
}

function buildWeeklySchedule(assignments = [], slotMap = null, placementRoomMap = null) {
  const resolvedSlotMap = slotMap || buildGlobalSlotMap(assignments)
  const schedule = createEmptySchedule()
  return applyAssignmentsToSchedule(schedule, assignments, resolvedSlotMap, placementRoomMap)
}

function formatSessionLine(session) {
  if (!session) return '_Free period_'
  const parts = [
    session.subject,
    session.teacherName ? `with ${session.teacherName}` : null,
    session.className ? `(${session.className})` : null,
    session.room ? `Room ${session.room}` : null
  ].filter(Boolean)
  return parts.join(' · ')
}

function formatWeeklyScheduleMarkdown(schedule, title, subtitle = '') {
  const lines = [`# ${title}`]
  if (subtitle) lines.push('', subtitle, '')
  lines.push(
    '_Full week (Monday–Friday), school hours 08:00–17:00. Generated from teaching assignments._',
    ''
  )

  schedule.forEach((dayRow) => {
    lines.push(`## ${dayRow.day}`)
    dayRow.slots.forEach((slot) => {
      lines.push(`- **${slot.time}** — ${formatSessionLine(slot.session)}`)
    })
    lines.push('')
  })

  return lines.join('\n')
}

function formatTeacherTimetableMarkdown(assignments, teacherName) {
  const schedule = buildWeeklySchedule(assignments)
  return formatWeeklyScheduleMarkdown(
    schedule,
    `Teacher Timetable — ${teacherName || 'Teacher'}`,
    'Your weekly teaching schedule based on assigned classes and subjects.'
  )
}

function formatClassTimetableMarkdown(assignments, className) {
  return formatClassTimetableGridHtml(assignments, className)
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SUBJECT_COLOR_RULES = [
  { pattern: /math|algebra|geometry|calculus|tables/i, className: 'tt-subject--math' },
  { pattern: /english|literacy|reading|writing/i, className: 'tt-subject--english' },
  { pattern: /gaeilge|irish|french|german|spanish|language/i, className: 'tt-subject--language' },
  { pattern: /music|drama|art|visual|dramaíocht/i, className: 'tt-subject--arts' },
  { pattern: /religion|re\b|faith/i, className: 'tt-subject--religion' },
  { pattern: /science|physics|chemistry|biology/i, className: 'tt-subject--science' },
  { pattern: /history|geography|social/i, className: 'tt-subject--humanities' },
  { pattern: /sport|pe|physical/i, className: 'tt-subject--pe' },
  { pattern: /computer|informatics|coding/i, className: 'tt-subject--alt2' },
  { pattern: /philosophy|philosophical/i, className: 'tt-subject--humanities' }
]

function getSubjectColorClass(subject) {
  const label = String(subject || '').trim()
  if (!label) return 'tt-subject--empty'
  const rule = SUBJECT_COLOR_RULES.find((entry) => entry.pattern.test(label))
  if (rule) return rule.className
  let hash = 0
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash)
  }
  const palette = [
    'tt-subject--alt1',
    'tt-subject--alt2',
    'tt-subject--alt3',
    'tt-subject--alt4'
  ]
  return palette[Math.abs(hash) % palette.length]
}

function buildTimetableGridRows(schedule) {
  const rows = []
  const breaksByPeriod = new Map(DAY_BREAKS.map((entry) => [entry.afterPeriod, entry]))

  TIME_SLOTS.forEach((slot) => {
    rows.push({
      time: slot.time,
      isBreak: false,
      cells: schedule.map(
        (dayRow) => dayRow.slots.find((entry) => entry.period === slot.period)?.session || null
      )
    })

    const breakRow = breaksByPeriod.get(slot.period)
    if (breakRow) {
      rows.push({ time: breakRow.time, isBreak: true, label: breakRow.label })
    }
  })

  return rows
}

function renderTimetableSessionCell(session, perspective = 'student') {
  if (!session) {
    return '<td class="tt-cell tt-subject--empty"><span class="tt-subject">—</span></td>'
  }

  const colorClass = getSubjectColorClass(session.subject)
  const detail =
    perspective === 'teacher'
      ? session.className
        ? `<span class="tt-teacher">${escapeHtml(session.className)}</span>`
        : ''
      : session.teacherName
        ? `<span class="tt-teacher">${escapeHtml(session.teacherName)}</span>`
        : ''
  const room = session.room ? `<span class="tt-room">Room ${escapeHtml(session.room)}</span>` : ''

  return `<td class="tt-cell ${colorClass}"><span class="tt-subject">${escapeHtml(session.subject)}</span>${detail}${room}</td>`
}

function formatTimetableGridHtml(schedule, title, subtitle = '', perspective = 'student') {
  const rows = buildTimetableGridRows(schedule)
  const dayHeaders = WEEK_DAYS.map((day) => `<th scope="col">${day}</th>`).join('')
  const bodyRows = rows
    .map((row) => {
      if (row.isBreak) {
        return `<tr class="tt-row-break"><td class="tt-time">${escapeHtml(row.time)}</td><td class="tt-cell tt-break" colspan="5">${escapeHtml(row.label)}</td></tr>`
      }

      const cells = row.cells.map((session) => renderTimetableSessionCell(session, perspective)).join('')
      return `<tr><td class="tt-time">${escapeHtml(row.time)}</td>${cells}</tr>`
    })
    .join('')

  const subtitleHtml = subtitle
    ? `<p class="timetable-grid-subtitle">${escapeHtml(subtitle)}</p>`
    : ''

  return `<div class="timetable-grid-wrap">
<h3 class="timetable-grid-title">${escapeHtml(title)}</h3>
${subtitleHtml}
<div class="timetable-grid-scroll">
<table class="timetable-grid">
<thead><tr><th scope="col">Time</th>${dayHeaders}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</div>
<p class="timetable-grid-note">Full week (Monday–Friday), 08:00–17:00. Each subject appears at most once per day; the day is filled with different courses when enough subjects are assigned to the class.</p>
</div>`
}

function formatClassTimetableGridHtml(
  assignments,
  className,
  studentName = '',
  scheduling = null
) {
  const slotMap = scheduling?.slotMap || buildGlobalSlotMap(assignments)
  const placementRoomMap = scheduling?.placementRoomMap || null
  const schedule = buildWeeklySchedule(assignments, slotMap, placementRoomMap)
  const usedRooms = roomsUsedInSchedule(schedule)
  const title = studentName
    ? `${studentName} — ${className || 'Class'} Timetable`
    : `${className || 'Class'} Timetable`
  const subtitle = usedRooms.length
    ? `Rooms across the week: ${usedRooms.join(', ')}`
    : className
      ? `Weekly schedule for ${className}`
      : 'Weekly class schedule'
  return formatTimetableGridHtml(schedule, title, subtitle)
}

function formatTeacherTimetableGridHtml(assignments, teacherName, scheduling = null) {
  const slotMap = scheduling?.slotMap || buildGlobalSlotMap(assignments)
  const schedule = buildWeeklySchedule(assignments, slotMap, scheduling?.placementRoomMap || null)
  return formatTimetableGridHtml(
    schedule,
    `Teacher Timetable — ${teacherName || 'Teacher'}`,
    'Weekly teaching schedule by class, subject, and room.',
    'teacher'
  )
}

function groupAssignmentsByTeacher(assignments = []) {
  const byTeacher = new Map()
  assignments.forEach((row) => {
    const key = row.teacher?.id || 'unassigned'
    if (!byTeacher.has(key)) byTeacher.set(key, { teacher: row.teacher, rows: [] })
    byTeacher.get(key).rows.push(row)
  })
  return byTeacher
}

function formatSchoolStudentsTimetableHtml(assignments = [], rooms = []) {
  const byClass = groupAssignmentsByClass(assignments)
  if (!byClass.size) {
    return '<p>No teaching assignments found. Assign teachers to classes first.</p>'
  }

  const scheduling = createSchedulingPlan(assignments, rooms)
  const grids = []
  byClass.forEach(({ class: klass, rows }) => {
    const schedule = buildWeeklySchedule(rows, scheduling.slotMap, scheduling.placementRoomMap)
    const usedRooms = roomsUsedInSchedule(schedule)
    const subtitle = usedRooms.length
      ? `Rooms across the week: ${usedRooms.join(', ')}`
      : 'Weekly class schedule'
    grids.push(
      formatTimetableGridHtml(
        schedule,
        `${klass?.name || 'Unassigned class'} Timetable`,
        subtitle,
        'student'
      )
    )
  })

  return grids.join('\n')
}

function buildMasterScheduleByTime(assignments = [], scheduling = null) {
  const plan = scheduling || createSchedulingPlan(assignments, [])
  const byClass = groupAssignmentsByClass(assignments)
  const master = WEEK_DAYS.map((day) => ({
    day,
    slots: TIME_SLOTS.map((slot) => ({
      ...slot,
      sessions: []
    }))
  }))

  byClass.forEach(({ rows }) => {
    const classSchedule = buildWeeklySchedule(rows, plan.slotMap, plan.placementRoomMap)
    classSchedule.forEach((dayRow, dayIndex) => {
      dayRow.slots.forEach((slot, slotIndex) => {
        if (slot.session) {
          master[dayIndex].slots[slotIndex].sessions.push(slot.session)
        }
      })
    })
  })

  return master
}

function formatRoomTimetableGridHtml(allAssignments = [], roomName = '', scheduling = null) {
  const plan = scheduling || createSchedulingPlan(allAssignments, [])
  const master = buildMasterScheduleByTime(allAssignments, plan)
  const schedule = master.map((dayRow) => ({
    day: dayRow.day,
    slots: dayRow.slots.map((slot) => ({
      ...slot,
      session: slot.sessions.find((session) => session.room === roomName) || null
    }))
  }))

  return formatTimetableGridHtml(
    schedule,
    `Room ${roomName}`,
    'Sessions scheduled in this room across the week.'
  )
}

function renderMasterScheduleCell(sessions = []) {
  if (!sessions.length) {
    return '<td class="tt-cell tt-subject--empty"><span class="tt-subject">—</span></td>'
  }

  const blocks = sessions
    .map((session) => {
      const colorClass = getSubjectColorClass(session.subject)
      const parts = [
        `<span class="tt-subject">${escapeHtml(session.subject)}</span>`,
        session.className ? `<span class="tt-teacher">${escapeHtml(session.className)}</span>` : '',
        session.room ? `<span class="tt-room">${escapeHtml(session.room)}</span>` : ''
      ].join('')
      return `<div class="tt-master-block ${colorClass}">${parts}</div>`
    })
    .join('')

  return `<td class="tt-cell tt-master-cell">${blocks}</td>`
}

function formatMasterScheduleByTimeHtml(assignments = [], rooms = []) {
  const scheduling = createSchedulingPlan(assignments, rooms)
  const master = buildMasterScheduleByTime(assignments, scheduling)
  const rows = []
  const breaksByPeriod = new Map(DAY_BREAKS.map((entry) => [entry.afterPeriod, entry]))

  TIME_SLOTS.forEach((slot) => {
    rows.push({
      time: slot.time,
      isBreak: false,
      cells: master.map(
        (dayRow) => dayRow.slots.find((entry) => entry.period === slot.period)?.sessions || []
      )
    })

    const breakRow = breaksByPeriod.get(slot.period)
    if (breakRow) {
      rows.push({ time: breakRow.time, isBreak: true, label: breakRow.label })
    }
  })

  const dayHeaders = WEEK_DAYS.map((day) => `<th scope="col">${day}</th>`).join('')
  const bodyRows = rows
    .map((row) => {
      if (row.isBreak) {
        return `<tr class="tt-row-break"><td class="tt-time">${escapeHtml(row.time)}</td><td class="tt-cell tt-break" colspan="5">${escapeHtml(row.label)}</td></tr>`
      }

      const cells = row.cells.map((sessions) => renderMasterScheduleCell(sessions)).join('')
      return `<tr><td class="tt-time">${escapeHtml(row.time)}</td>${cells}</tr>`
    })
    .join('')

  return `<div class="timetable-grid-wrap">
<h3 class="timetable-grid-title">School Schedule by Time</h3>
<p class="timetable-grid-subtitle">All classes organized by day and time, with room assignments.</p>
<div class="timetable-grid-scroll">
<table class="timetable-grid timetable-grid--master">
<thead><tr><th scope="col">Time</th>${dayHeaders}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</div>
<p class="timetable-grid-note">Each cell lists subject, class, and room. Classes rotate through different rooms across the week.</p>
</div>`
}

function formatSchoolTeachersTimetableHtml(assignments = [], rooms = []) {
  const byTeacher = groupAssignmentsByTeacher(assignments)
  if (!byTeacher.size) {
    return '<p>No teaching assignments found. Assign teachers to classes first.</p>'
  }

  const scheduling = createSchedulingPlan(assignments, rooms)
  const grids = []
  byTeacher.forEach(({ teacher, rows }) => {
    grids.push(formatTeacherTimetableGridHtml(rows, teacher?.name, scheduling))
  })

  return grids.join('\n')
}

function formatSchoolTimetableMarkdown(assignments) {
  const slotMap = buildGlobalSlotMap(assignments)
  const byClass = new Map()
  assignments.forEach((row) => {
    const key = row.class?.id || 'unassigned'
    if (!byClass.has(key)) {
      byClass.set(key, { class: row.class, rows: [] })
    }
    byClass.get(key).rows.push(row)
  })

  const lines = [
    '# School Timetable',
    '',
    '_Overview of weekly schedules by class and teacher, generated from teaching assignments._',
    ''
  ]

  byClass.forEach(({ class: klass, rows }) => {
    lines.push(`## ${klass?.name || 'Unassigned class'}`)
    if (klass?.room) lines.push(`Room: ${klass.room}`)
    lines.push('')
    const schedule = buildWeeklySchedule(rows, slotMap)
    schedule.forEach((dayRow) => {
      const sessions = dayRow.slots
        .filter((s) => s.session)
        .map((s) => `  - ${s.time}: ${formatSessionLine(s.session)}`)
      if (sessions.length) {
        lines.push(`### ${dayRow.day}`)
        lines.push(...sessions)
        lines.push('')
      }
    })
  })

  lines.push('## Teachers')
  const byTeacher = new Map()
  assignments.forEach((row) => {
    const key = row.teacher?.id || 'unassigned'
    if (!byTeacher.has(key)) byTeacher.set(key, { teacher: row.teacher, rows: [] })
    byTeacher.get(key).rows.push(row)
  })

  byTeacher.forEach(({ teacher, rows }) => {
    const subjects = [...new Set(rows.map((r) => `${r.course?.title || 'Subject'} (${r.class?.name || 'Class'})`))]
    lines.push(`- **${teacher?.name || 'Unassigned'}** — ${subjects.join('; ')}`)
  })

  return lines.join('\n')
}

module.exports = {
  fetchTeachingAssignments,
  fetchRooms,
  prepareAssignmentsWithAutoRooms,
  createSchedulingPlan,
  buildGlobalSlotMap,
  buildWeeklySchedule,
  formatWeeklyScheduleMarkdown,
  formatTeacherTimetableMarkdown,
  formatClassTimetableMarkdown,
  formatClassTimetableGridHtml,
  formatTeacherTimetableGridHtml,
  formatRoomTimetableGridHtml,
  formatTimetableGridHtml,
  formatSchoolStudentsTimetableHtml,
  formatSchoolTeachersTimetableHtml,
  formatSchoolTimetableMarkdown,
  formatMasterScheduleByTimeHtml,
  groupAssignmentsByClass
}
