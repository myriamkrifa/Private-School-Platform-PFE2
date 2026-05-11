# Private School Platform PFE - Project Description

## 1. Project Overview

Private School Platform PFE is a full-stack school management system designed to centralize core academic and administrative operations in one application.

The platform supports four user roles:
- ADMIN
- TEACHER
- PARENT
- STUDENT

It provides role-based access to school data and actions such as user management, class organization, grades, attendance tracking, assignments, announcements, messaging, and notifications.

## 2. Main Goal

The goal of this project is to digitize daily school workflows and improve communication between administration, teachers, parents, and students.

It aims to:
- Reduce manual management tasks.
- Provide secure access to educational data.
- Offer clear role-based dashboards and pages.
- Improve follow-up of student performance and attendance.

## 3. Technology Stack

### Frontend
- React 18
- Vite
- React Router DOM
- Axios

### Backend
- Node.js
- Express
- Prisma ORM
- JWT authentication
- bcryptjs for password hashing

### Database
- PostgreSQL

### Dev and Infra
- Docker and Docker Compose for local database provisioning
- Nodemon for backend development

## 4. High-Level Architecture

The project is organized into two major applications:

1. Frontend (client app)
- Single Page Application built with React.
- Handles UI rendering, routing, and role-based navigation.
- Stores authentication token and user data in local storage.

2. Backend (REST API)
- Express server exposing role-protected endpoints.
- Uses Prisma to communicate with PostgreSQL.
- Handles business logic, validation, and authorization.

Communication flow:
- Frontend sends HTTP requests using Axios.
- JWT token is attached as Bearer token to protected requests.
- Backend validates token and role before processing.
- Backend returns JSON responses consumed by frontend pages.

## 5. Authentication and Authorization

### Authentication
- Users register and log in through API endpoints.
- Passwords are hashed using bcryptjs.
- On successful login, backend returns a signed JWT.
- Frontend stores token and user object in local storage.

### Authorization
- Backend middleware enforces access control:
  - protect: verifies JWT
  - authorize: checks allowed roles for each endpoint
- Frontend also limits route access through protected routes and allowed role lists.

This gives two levels of protection:
- UI-level access control
- Server-level security enforcement

## 6. Functional Modules

### 6.1 User and Role Management
- Admin can list users.
- Admin can update user roles.

### 6.2 Student Management
- Create, list, view, and delete students.
- Link parent accounts to students.
- Retrieve student progress summary.

### 6.3 Teacher Management
- Create, list, view, and delete teachers.

### 6.4 Class Management
- Create classes with room, level, teacher, and optional academic year.
- Assign students to classes.
- View class summaries and student count.

### 6.5 Academic Years
- Create and manage academic years.
- One academic year can be marked active.

### 6.6 Grades
- Teachers and admins can record grades.
- Parents and students can view grades.
- API supports average calculation and CSV export.
- Grade creation can trigger parent notifications.

### 6.7 Attendance
- Teachers and admins can mark attendance.
- Attendance supports PRESENT and ABSENT statuses.
- Absences can be justified.
- Absence records can trigger parent notifications.

### 6.8 Courses and Materials
- Create and list courses.
- Add and retrieve course materials.

### 6.9 Assignments and Submissions
- Teachers and admins can create assignments.
- Students can submit assignments.
- Teachers and admins can view submissions.

### 6.10 Announcements
- Admin can publish announcements.
- All roles can read announcements.
- Announcement publishing can generate notifications for users.

### 6.11 Messaging
- Inbox for admins, teachers, and parents.
- Teacher-parent direct messaging allowed for non-admin users.
- Admin can message more broadly.
- Sending a message creates a notification for recipient.

### 6.12 Notifications
- Users can fetch their notifications.
- Users can mark one or all notifications as read.

## 7. Frontend Structure Summary

- src/main.jsx initializes React app and authentication provider.
- src/App.jsx defines routes (public and protected).
- src/context/AuthContext.jsx manages auth state, login, logout, and persistence.
- src/components/ProtectedRoute.jsx guards private pages by authentication and role.
- src/components/Sidebar.jsx renders role-based navigation menu.
- src/config/roleAccess.js defines dashboard modules and sidebar links by role.
- src/services/auth.service.js contains Axios client and API service methods.
- src/pages contains page-level UI for each module.

## 8. Backend Structure Summary

- src/app.js bootstraps Express app, middleware, and route mounting.
- src/middlewares/auth.middleware.js contains JWT protection and role checks.
- src/controllers contains business logic by module.
- src/routes maps URL endpoints to controllers and middleware.
- prisma/schema.prisma defines data models, enums, and relationships.
- src/prisma.js creates and reuses Prisma client instance.

## 9. Data Model Summary

Core entities include:
- User (with Role enum)
- Student
- Teacher
- Class
- AcademicYear
- ParentStudent (parent-student linking table)
- Grade
- Attendance
- Course
- CourseMaterial
- Assignment
- Submission
- Announcement
- Message
- Notification

Important relationships:
- Parent accounts are connected to students through ParentStudent.
- Class belongs to Teacher and optional AcademicYear.
- Course links to Class and Teacher user account.
- Assignment belongs to Course.
- Submission links Assignment and Student.
- Grade and Attendance are linked to Student and optionally to acting user.
- Message links sender and recipient users.
- Notification belongs to a user.

## 10. API Design Notes

The API follows REST-style patterns and returns JSON for most endpoints.

Examples:
- /api/auth/* for authentication
- /api/students/* for student operations
- /api/grades/* for grade operations
- /api/attendance/* for attendance operations

A dedicated health endpoint exists:
- GET /api/health

## 11. Local Development Workflow

### Backend
1. Configure environment variables in backend/.env.
2. Start PostgreSQL (Docker Compose).
3. Install dependencies.
4. Run Prisma migrations and generate client.
5. Start backend development server.

### Frontend
1. Install dependencies.
2. Start Vite development server.
3. Connect to backend through configured API URL.

## 12. Current Project Strengths

- Clear full-stack separation between frontend and backend.
- Role-based access in both client and server.
- Rich school feature coverage across many modules.
- Prisma schema includes comprehensive domain modeling.
- Notification hooks integrated with key events (grades, absences, messages, announcements).

## 13. Areas for Future Improvement

- Add automated tests (unit and integration).
- Add request validation layer (schema validation) for all endpoints.
- Improve dashboards with real metrics instead of placeholders.
- Align teacher representation to reduce dual-model complexity (Teacher model vs User role).
- Add auditing/logging for sensitive actions.
- Add production-ready deployment config and CI/CD.

## 14. Conclusion

Private School Platform PFE is a strong full-stack foundation for a digital school management product.

It already supports the most important operational workflows for administrators, teachers, parents, and students, while using a modern web architecture that can scale with additional features and production hardening.
