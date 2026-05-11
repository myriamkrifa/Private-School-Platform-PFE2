import {
  BarChart3,
  BookOpen,
  CalendarDays,
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
    'Manage reports'
  ],
  TEACHER: [
    'Manage grades',
    'Manage attendance',
    'Manage courses',
    'Manage parent communication'
  ],
  PARENT: [
    'View children profiles',
    'View grades',
    'View attendance',
    'View announcements'
  ],
  STUDENT: [
    'Access timetable',
    'Access grades',
    'Access assignments',
    'Access course materials'
  ]
}

export const navigationItemsByRole = {
  ADMIN: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Users', path: '/users' },
    { icon: GraduationCap, label: 'Students', path: '/students' },
    { icon: Users, label: 'Teachers', path: '/teachers' },
    { icon: Users, label: 'Parents', path: '/parents' },
    { icon: CalendarDays, label: 'Academic Years', path: '/academic-years' },
    { icon: School, label: 'Classes', path: '/classes' },
    { icon: BookOpen, label: 'Subjects', path: '/subjects' },
    { icon: ClipboardList, label: 'Teaching Assignments', path: '/teaching-assignments' },
    { icon: GraduationCap, label: 'Grades', path: '/grades' },
    { icon: CalendarDays, label: 'Attendance', path: '/attendance' },
    { icon: ClipboardList, label: 'Assignments', path: '/assignments' },
    { icon: BookOpen, label: 'Courses', path: '/courses' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
    { icon: Megaphone, label: 'Announcements', path: '/announcements' },
    { icon: Inbox, label: 'Messages', path: '/messages' },
    { icon: Inbox, label: 'Notifications', path: '/notifications' }
  ],
  TEACHER: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: School, label: 'My Classes', path: '/classes' },
    { icon: GraduationCap, label: 'Students', path: '/students' },
    { icon: BookOpen, label: 'Subjects', path: '/subjects' },
    { icon: GraduationCap, label: 'Grades', path: '/grades' },
    { icon: CalendarDays, label: 'Attendance', path: '/attendance' },
    { icon: ClipboardList, label: 'Assignments', path: '/assignments' },
    { icon: BookOpen, label: 'Courses', path: '/courses' },
    { icon: Megaphone, label: 'Announcements', path: '/announcements' },
    { icon: Inbox, label: 'Messages', path: '/messages' },
    { icon: Inbox, label: 'Notifications', path: '/notifications' }
  ],
  PARENT: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: GraduationCap, label: 'Grades', path: '/grades' },
    { icon: CalendarDays, label: 'Attendance', path: '/attendance' },
    { icon: ClipboardList, label: 'Assignments', path: '/assignments' },
    { icon: BookOpen, label: 'Courses', path: '/courses' },
    { icon: Megaphone, label: 'Announcements', path: '/announcements' },
    { icon: Inbox, label: 'Messages', path: '/messages' },
    { icon: Inbox, label: 'Notifications', path: '/notifications' }
  ],
  STUDENT: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: School, label: 'My Class', path: '/classes' },
    { icon: BookOpen, label: 'Subjects', path: '/subjects' },
    { icon: GraduationCap, label: 'Grades', path: '/grades' },
    { icon: CalendarDays, label: 'Attendance', path: '/attendance' },
    { icon: ClipboardList, label: 'Assignments', path: '/assignments' },
    { icon: BookOpen, label: 'Course Materials', path: '/courses' },
    { icon: Megaphone, label: 'Announcements', path: '/announcements' },
    { icon: Inbox, label: 'Notifications', path: '/notifications' }
  ]
}

export const sidebarItemsByRole = navigationItemsByRole
