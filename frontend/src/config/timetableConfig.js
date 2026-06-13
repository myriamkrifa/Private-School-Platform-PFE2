export const TIMETABLE_PAGES = {
  students: {
    reportType: 'TIMETABLE_STUDENTS',
    label: 'Student Timetables',
    description: 'Weekly class schedules for all students, by class.',
    subtitle: 'Generate weekly class schedules for all students, grouped by class.'
  },
  teachers: {
    reportType: 'TIMETABLE_TEACHERS',
    label: 'Teacher Timetables',
    description: 'Weekly teaching schedules for all teachers.',
    subtitle: 'Generate weekly teaching schedules for all teachers.'
  }
}

export function getTimetablePageConfig(slug) {
  return TIMETABLE_PAGES[slug] || null
}

/** Match saved reports — older rows used type TIMETABLE + title. */
export function matchesTimetableReport(report, config) {
  if (!report || !config) return false
  if (report.type === config.reportType) return true
  return report.type === 'TIMETABLE' && report.title === config.label
}
