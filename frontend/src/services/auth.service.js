import API from './apiClient'

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
export const registerUser = (data) => API.post('/auth/register', data)
export const loginUser   = (data) => API.post('/auth/login', data)
export const firebaseGoogleLogin = (idToken) => API.post('/auth/firebase-google', { idToken })
export const getMe       = ()     => API.get('/auth/me')
export const logoutUser  = ()     => API.post('/auth/logout')

// ─────────────────────────────────────────────
// Users (admin)
// ─────────────────────────────────────────────
export const getAllUsers = () => API.get('/users')
export const approveUser = (id) => API.patch(`/users/${id}/approve`)
export const provisionStudentWithParent = (data) => API.post('/users/provision/student', data)
export const provisionTeacher = (data) => API.post('/users/provision/teacher', data)
export const updateUserRole = (id, role) => API.patch(`/users/${id}/role`, { role })

// ─────────────────────────────────────────────
// Dashboards (per role)
// ─────────────────────────────────────────────
export const getAdminDashboard = () => API.get('/admin/dashboard')
export const getTeacherDashboard = () => API.get('/teacher/dashboard')
export const getParentDashboard = () => API.get('/parent/dashboard')
export const getStudentDashboard = () => API.get('/student/dashboard')

// ─────────────────────────────────────────────
// Students
// ─────────────────────────────────────────────
export const getAllStudents = () => API.get('/students')
export const getStudentById = (id) => API.get(`/students/${id}`)
export const getMyChildren = () => API.get('/students/me/children')
export const createStudent = (data) => API.post('/students', data)
export const updateStudent = (id, data) => API.put(`/students/${id}`, data)
export const deleteStudent = (id) => API.delete(`/students/${id}`)
export const linkParentToStudent = (studentId, data) => API.post(`/students/${studentId}/parents`, data)
export const getStudentProgress = (studentId) => API.get(`/students/${studentId}/progress`)

// ─────────────────────────────────────────────
// Teachers
// ─────────────────────────────────────────────
export const getAllTeachers = () => API.get('/teachers')
export const getTeacherById = (id) => API.get(`/teachers/${id}`)
export const createTeacher = (data) => API.post('/teachers', data)
export const updateTeacher = (id, data) => API.put(`/teachers/${id}`, data)
export const deleteTeacher = (id) => API.delete(`/teachers/${id}`)

// ─────────────────────────────────────────────
// Parents
// ─────────────────────────────────────────────
export const getAllParents = () => API.get('/parents')
export const getParentById = (id) => API.get(`/parents/${id}`)
export const updateParent = (id, data) => API.put(`/parents/${id}`, data)
export const deleteParent = (id) => API.delete(`/parents/${id}`)

// ─────────────────────────────────────────────
// Classes
// ─────────────────────────────────────────────
export const getAllClasses = () => API.get('/classes')
export const getClassById = (id) => API.get(`/classes/${id}`)
export const createClass = (data) => API.post('/classes', data)
export const updateClass = (id, data) => API.put(`/classes/${id}`, data)
export const deleteClass = (id) => API.delete(`/classes/${id}`)
export const assignStudentToClass = (id, data) => API.post(`/classes/${id}/students`, data)
export const removeStudentFromClass = (id, studentId) => API.delete(`/classes/${id}/students/${studentId}`)
export const assignTeacherToClass = (id, data) => API.post(`/classes/${id}/teachers`, data)
export const removeTeacherFromClass = (id, teacherId) => API.delete(`/classes/${id}/teachers/${teacherId}`)

// ─────────────────────────────────────────────
// Academic Years
// ─────────────────────────────────────────────
export const getAcademicYears = (params) => API.get('/academic-years', { params })
export const createAcademicYear = (data) => API.post('/academic-years', data)
export const updateAcademicYear = (id, data) => API.patch(`/academic-years/${id}`, data)
export const activateAcademicYear = (id) => API.patch(`/academic-years/${id}`, { isActive: true })
export const archiveAcademicYear = (id) => API.patch(`/academic-years/${id}/archive`)
export const restoreAcademicYear = (id) => API.patch(`/academic-years/${id}/restore`)
export const deleteAcademicYear = (id) => API.delete(`/academic-years/${id}`)

// ─────────────────────────────────────────────
// Subjects (Course)
// ─────────────────────────────────────────────
export const getSubjects = () => API.get('/subjects')
export const getSubjectById = (id) => API.get(`/subjects/${id}`)
export const createSubject = (data) => API.post('/subjects', data)
export const updateSubject = (id, data) => API.put(`/subjects/${id}`, data)
export const deleteSubject = (id) => API.delete(`/subjects/${id}`)

// Legacy/compatibility aliases (Course == Subject)
export const getAllCourses = () => API.get('/courses')
export const createCourse = (data) => API.post('/courses', data)
export const getCourseMaterials = (courseId) => API.get(`/courses/${courseId}/materials`)
export const listCourseMaterials = () => API.get('/courses/materials')
export const addCourseMaterial = (courseId, data) => API.post(`/courses/${courseId}/materials`, data)
export const deleteCourseMaterial = (id) => API.delete(`/courses/materials/${id}`)

// ─────────────────────────────────────────────
// Grades
// ─────────────────────────────────────────────
export const createGrade = (data) => API.post('/grades', data)
export const bulkUpsertGrades = (data) => API.post('/grades/bulk-upsert', data)
export const getStudentGrades = (studentId) => API.get(`/grades/student/${studentId}`)
export const getStudentAverage = (studentId) => API.get(`/grades/student/${studentId}/average`)
export const getClassAverage = (classId) => API.get(`/grades/class/${classId}/average`)
export const exportStudentGrades = (studentId) => API.get(`/grades/student/${studentId}/export`)

// ─────────────────────────────────────────────
// Attendance
// ─────────────────────────────────────────────
export const markAttendance = (data) => API.post('/attendance', data)
export const bulkUpsertAttendance = (data) => API.post('/attendance/bulk-upsert', data)
export const getStudentAttendance = (studentId) => API.get(`/attendance/student/${studentId}`)
export const justifyAbsence = (attendanceId, data) => API.patch(`/attendance/${attendanceId}/justify`, data)

// ─────────────────────────────────────────────
// Assignments
// ─────────────────────────────────────────────
export const createAssignment = (data) => API.post('/assignments', data)
export const getCourseAssignments = (courseId) => API.get(`/assignments/course/${courseId}`)
export const submitAssignment = (assignmentId, data) => API.post(`/assignments/${assignmentId}/submissions`, data)
export const getAssignmentSubmissions = (assignmentId) => API.get(`/assignments/${assignmentId}/submissions`)

// ─────────────────────────────────────────────
// Teaching assignments + teacher workspace
// ─────────────────────────────────────────────
export const createTeachingAssignment = (data) => API.post('/teaching-assignments', data)
export const getTeachingAssignments = () => API.get('/teaching-assignments')
export const deleteTeachingAssignment = (id) => API.delete(`/teaching-assignments/${id}`)
export const getTeacherClasses = () => API.get('/teacher/classes')
export const getTeacherClassStudents = (classId) => API.get(`/teacher/classes/${classId}/students`)
export const getTeacherClassSubjects = (classId) => API.get(`/teacher/classes/${classId}/subjects`)

// ─────────────────────────────────────────────
// Communication
// ─────────────────────────────────────────────
export const getAnnouncements = () => API.get('/announcements')
export const createAnnouncement = (data) => API.post('/announcements', data)
export const getInboxMessages = () => API.get('/messages/inbox')
export const getSentMessages = () => API.get('/messages/sent')
export const getMessageContacts = () => API.get('/messages/contacts')
export const sendMessage = (data) => API.post('/messages', data)
export const markMessageAsRead = (id) => API.patch(`/messages/${id}/read`)

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────
export const getMyNotifications = () => API.get('/notifications/me')
export const markNotificationAsRead = (id) => API.patch(`/notifications/${id}/read`)
export const markAllNotificationsAsRead = () => API.patch('/notifications/me/read-all')

// ─────────────────────────────────────────────
// Audit (admin)
// ─────────────────────────────────────────────
export const getAuditLogs = (limit = 100) => API.get(`/audit?limit=${limit}`)

export default API
