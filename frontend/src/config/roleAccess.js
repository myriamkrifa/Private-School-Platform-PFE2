import {
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Megaphone,
  School,
  Users
} from 'lucide-react'

export const dashboardModulesByRole = {
  ADMIN: [
    'Manage users',
    'Manage classes',
    'Manage academic years',
    'Manage teachers',
    'AI Assistant insights',
  ],
  TEACHER: [
    'Manage grades',
    'Manage attendance',
    'Manage courses',
    'Manage parent communication',
    'AI teaching assistant'
  ],
  PARENT: [
    'View children profiles',
    'View grades',
    'View attendance',
    'View announcements',
    'AI family assistant'
  ],
  STUDENT: [
    'Access timetable',
    'Access grades',
    'Access assignments',
    'Access course materials',
    'AI study assistant'
  ]
}

export const navigationItemsByRole = {
  ADMIN: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', section: 'Overview', accent: 'neutral' },
    { icon: GraduationCap, label: 'Students', path: '/students', section: 'People', accent: 'blue' },
    { icon: Users, label: 'Teachers', path: '/teachers', section: 'People', accent: 'orange' },
    { icon: Users, label: 'Parents', path: '/parents', section: 'People', accent: 'orange' },
    { icon: CalendarDays, label: 'Academic Years', path: '/academic-years', section: 'Academic', accent: 'blue' },
    { icon: School, label: 'Classes', path: '/classes', section: 'Academic', accent: 'orange' },
    { icon: BookOpen, label: 'Subjects', path: '/subjects', section: 'Academic', accent: 'blue' },
    {
      icon: ClipboardList,
      label: 'Teaching Assignments',
      path: '/teaching-assignments',
      section: 'Academic',
      accent: 'orange'
    },
    { icon: GraduationCap, label: 'Grades', path: '/grades', section: 'Academic', accent: 'blue' },
    { icon: CalendarDays, label: 'Attendance', path: '/attendance', section: 'Academic', accent: 'orange' },
    { icon: BookOpen, label: 'Courses', path: '/courses', section: 'Academic', accent: 'blue' },
    {
      icon: CalendarRange,
      label: 'TimeTable',
      path: '/timetables/students',
      section: 'Academic',
      accent: 'blue'
    },
    { icon: Megaphone, label: 'Announcements', path: '/announcements', section: 'Communication', accent: 'orange' },
    { icon: Inbox, label: 'Messages', path: '/messages', section: 'Communication', accent: 'blue' },
    { icon: Bell, label: 'Notifications', path: '/notifications', section: 'Communication', accent: 'neutral' },
    { icon: Bot, label: 'AI Assistant', path: '/ai-assistant', section: 'Tools', accent: 'blue' }
  ],
  TEACHER: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', section: 'Workspace', accent: 'blue' },
    { icon: School, label: 'My Classes', path: '/classes', section: 'Workspace', accent: 'orange' },
    { icon: GraduationCap, label: 'Students', path: '/students', section: 'Workspace', accent: 'blue' },
    { icon: BookOpen, label: 'Subjects', path: '/subjects', section: 'Teaching', accent: 'orange' },
    { icon: GraduationCap, label: 'Grades', path: '/grades', section: 'Teaching', accent: 'blue' },
    { icon: CalendarDays, label: 'Attendance', path: '/attendance', section: 'Teaching', accent: 'orange' },
    { icon: CalendarRange, label: 'TimeTable', path: '/my-timetable', section: 'Teaching', accent: 'blue' },
    { icon: ClipboardList, label: 'Assignments', path: '/assignments', section: 'Teaching', accent: 'blue' },
    { icon: BookOpen, label: 'Courses', path: '/courses', section: 'Teaching', accent: 'orange' },
    { icon: Megaphone, label: 'Announcements', path: '/announcements', section: 'Communication', accent: 'blue' },
    { icon: Inbox, label: 'Messages', path: '/messages', section: 'Communication', accent: 'orange' },
    { icon: Bell, label: 'Notifications', path: '/notifications', section: 'Communication', accent: 'neutral' },
    { icon: Bot, label: 'AI Assistant', path: '/ai-assistant', section: 'Tools', accent: 'blue' }
  ],
  PARENT: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', section: 'Family', accent: 'blue' },
    { icon: GraduationCap, label: 'Grades', path: '/grades', section: 'Family', accent: 'orange' },
    { icon: CalendarDays, label: 'Attendance', path: '/attendance', section: 'Family', accent: 'blue' },
    { icon: CalendarRange, label: 'TimeTable', path: '/my-timetable', section: 'Family', accent: 'orange' },
    { icon: ClipboardList, label: 'Assignments', path: '/assignments', section: 'Family', accent: 'orange' },
    { icon: BookOpen, label: 'Courses', path: '/courses', section: 'Family', accent: 'blue' },
    { icon: Megaphone, label: 'Announcements', path: '/announcements', section: 'Communication', accent: 'orange' },
    { icon: Inbox, label: 'Messages', path: '/messages', section: 'Communication', accent: 'blue' },
    { icon: Bell, label: 'Notifications', path: '/notifications', section: 'Communication', accent: 'neutral' },
    { icon: Bot, label: 'AI Assistant', path: '/ai-assistant', section: 'Tools', accent: 'blue' }
  ],
  STUDENT: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', section: 'School', accent: 'blue' },
    { icon: School, label: 'My Class', path: '/classes', section: 'School', accent: 'orange' },
    { icon: BookOpen, label: 'Subjects', path: '/subjects', section: 'School', accent: 'blue' },
    { icon: GraduationCap, label: 'Grades', path: '/grades', section: 'School', accent: 'orange' },
    { icon: CalendarDays, label: 'Attendance', path: '/attendance', section: 'School', accent: 'blue' },
    { icon: CalendarRange, label: 'TimeTable', path: '/my-timetable', section: 'School', accent: 'orange' },
    { icon: ClipboardList, label: 'Assignments', path: '/assignments', section: 'School', accent: 'orange' },
    { icon: BookOpen, label: 'Course Materials', path: '/courses', section: 'School', accent: 'blue' },
    { icon: Megaphone, label: 'Announcements', path: '/announcements', section: 'Communication', accent: 'orange' },
    { icon: Bell, label: 'Notifications', path: '/notifications', section: 'Communication', accent: 'neutral' },
    { icon: Bot, label: 'AI Assistant', path: '/ai-assistant', section: 'Tools', accent: 'blue' }
  ]
}

/** Group flat nav items by section label for sidebar rendering. */
export function groupNavItemsBySection(items) {
  const groups = []
  const indexBySection = new Map()

  items.forEach((item) => {
    const section = item.section || 'Menu'
    if (!indexBySection.has(section)) {
      indexBySection.set(section, groups.length)
      groups.push({ section, items: [] })
    }
    groups[indexBySection.get(section)].items.push(item)
  })

  return groups
}

export const sidebarItemsByRole = navigationItemsByRole
