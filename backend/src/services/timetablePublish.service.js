const prisma = require('../prisma')
const {
  prepareAssignmentsWithAutoRooms,
  createSchedulingPlan,
  formatClassTimetableGridHtml,
  formatTeacherTimetableGridHtml,
  groupAssignmentsByClass
} = require('./aiTimetable.service')

function isStudentTimetableReport(report) {
  if (!report) return false
  return report.type === 'TIMETABLE' && report.title === 'Student Timetables'
}

async function replacePublishedTimetable(userId, payload) {
  await prisma.publishedTimetable.deleteMany({ where: { userId } })
  return prisma.publishedTimetable.create({
    data: {
      userId,
      title: payload.title,
      content: payload.content,
      publishedById: payload.publishedById,
      sourceReportId: payload.sourceReportId
    }
  })
}

async function notifyTimetablePublished(userId, title) {
  await prisma.notification.create({
    data: {
      userId,
      type: 'SYSTEM',
      title: 'Timetable published',
      message: `${title} is now available. Open TimeTable from the menu to view your weekly schedule.`
    }
  })
}

async function publishTimetable({ reportId, publisherId }) {
  const report = await prisma.aiGeneratedReport.findFirst({
    where: { id: reportId, userId: publisherId }
  })

  if (!report) {
    const err = new Error('Timetable report not found.')
    err.status = 404
    throw err
  }

  if (!isStudentTimetableReport(report)) {
    const err = new Error('Only generated student timetables can be accepted and published.')
    err.status = 400
    throw err
  }

  if (report.publishedAt) {
    const err = new Error('This timetable was already accepted and published.')
    err.status = 400
    throw err
  }

  const { assignments, rooms } = await prepareAssignmentsWithAutoRooms()
  if (!rooms.length) {
    const err = new Error('Create at least one room before publishing timetables.')
    err.status = 400
    throw err
  }
  if (!assignments.length) {
    const err = new Error('No teaching assignments found. Assign teachers to classes first.')
    err.status = 400
    throw err
  }

  const scheduling = createSchedulingPlan(assignments, rooms)
  const byClass = groupAssignmentsByClass(assignments)

  let studentsPublished = 0
  let parentsPublished = 0
  let teachersPublished = 0
  const notifiedUserIds = new Set()

  for (const [, { class: klass, rows }] of byClass) {
    if (!klass?.id) continue

    const students = await prisma.student.findMany({
      where: { classId: klass.id },
      select: { id: true, name: true, userId: true }
    })

    for (const student of students) {
      const content = formatClassTimetableGridHtml(rows, klass.name, student.name, scheduling)
      const title = `${student.name} — ${klass.name} Timetable`

      if (student.userId) {
        await replacePublishedTimetable(student.userId, {
          title,
          content,
          publishedById: publisherId,
          sourceReportId: report.id
        })
        if (!notifiedUserIds.has(student.userId)) {
          await notifyTimetablePublished(student.userId, title)
          notifiedUserIds.add(student.userId)
        }
        studentsPublished += 1
      }

      const parentLinks = await prisma.parentStudent.findMany({
        where: { studentId: student.id },
        select: { parentId: true }
      })

      for (const link of parentLinks) {
        const parentTitle = `${student.name} — ${klass.name} Timetable`
        await replacePublishedTimetable(link.parentId, {
          title: parentTitle,
          content,
          publishedById: publisherId,
          sourceReportId: report.id
        })
        if (!notifiedUserIds.has(link.parentId)) {
          await notifyTimetablePublished(link.parentId, parentTitle)
          notifiedUserIds.add(link.parentId)
        }
        parentsPublished += 1
      }
    }
  }

  const teacherProfiles = await prisma.teacher.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, userId: true }
  })

  for (const teacher of teacherProfiles) {
    const teacherRows = assignments.filter((row) => row.teacher?.id === teacher.id)
    if (!teacherRows.length || !teacher.userId) continue

    const content = formatTeacherTimetableGridHtml(teacherRows, teacher.name, scheduling)
    const title = `Teacher Timetable — ${teacher.name}`

    await replacePublishedTimetable(teacher.userId, {
      title,
      content,
      publishedById: publisherId,
      sourceReportId: report.id
    })

    if (!notifiedUserIds.has(teacher.userId)) {
      await notifyTimetablePublished(teacher.userId, title)
      notifiedUserIds.add(teacher.userId)
    }
    teachersPublished += 1
  }

  await prisma.aiGeneratedReport.update({
    where: { id: report.id },
    data: { publishedAt: new Date() }
  })

  return {
    studentsPublished,
    parentsPublished,
    teachersPublished,
    publishedAt: new Date()
  }
}

async function getMyPublishedTimetable(userId) {
  return prisma.publishedTimetable.findFirst({
    where: { userId },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      title: true,
      content: true,
      publishedAt: true
    }
  })
}

module.exports = {
  publishTimetable,
  getMyPublishedTimetable,
  isStudentTimetableReport
}
