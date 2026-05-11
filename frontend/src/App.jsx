import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login     from './pages/Login'
// Signup is disabled for public access; admins provision accounts from the Users page.
// import Register  from './pages/Register'
import Dashboard from './pages/Dashboard'
import Profile   from './pages/Profile'
import Students  from './pages/Students'
import Teachers  from './pages/Teachers'
import Parents   from './pages/Parents'
import Classes   from './pages/Classes'
import Users     from './pages/Users'
import AcademicYears from './pages/AcademicYears'
import Grades    from './pages/Grades'
import Attendance from './pages/Attendance'
import Courses   from './pages/Courses'
import Assignments from './pages/Assignments'
import TeachingAssignments from './pages/TeachingAssignments'
import Subjects from './pages/Subjects'
import Reports  from './pages/Reports'
import Announcements from './pages/Announcements'
import Messages  from './pages/Messages'
import Notifications from './pages/Notifications'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={<Login />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/users" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Users />
          </ProtectedRoute>
        } />
        <Route path="/teachers" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Teachers />
          </ProtectedRoute>
        } />
        <Route path="/parents" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Parents />
          </ProtectedRoute>
        } />
        <Route path="/academic-years" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AcademicYears />
          </ProtectedRoute>
        } />
        <Route path="/teaching-assignments" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <TeachingAssignments />
          </ProtectedRoute>
        } />
        <Route path="/subjects" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'PARENT', 'STUDENT']}>
            <Subjects />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Reports />
          </ProtectedRoute>
        } />

        {/* Shared role pages */}
        <Route path="/students" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER']}>
            <Students />
          </ProtectedRoute>
        } />
        <Route path="/classes" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'STUDENT']}>
            <Classes />
          </ProtectedRoute>
        } />
        <Route path="/grades" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'PARENT', 'STUDENT']}>
            <Grades />
          </ProtectedRoute>
        } />
        <Route path="/attendance" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'PARENT', 'STUDENT']}>
            <Attendance />
          </ProtectedRoute>
        } />
        <Route path="/courses" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']}>
            <Courses />
          </ProtectedRoute>
        } />
        <Route path="/assignments" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']}>
            <Assignments />
          </ProtectedRoute>
        } />
        <Route path="/announcements" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'PARENT', 'STUDENT']}>
            <Announcements />
          </ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'PARENT']}>
            <Messages />
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'PARENT', 'STUDENT']}>
            <Notifications />
          </ProtectedRoute>
        } />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
