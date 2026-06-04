# API Reference

Base URL: `http://localhost:5000/api`

All endpoints (except `POST /auth/login`) require `Authorization: Bearer <JWT>`.

## Authentication

| Method | Endpoint                        | Roles | Description                          |
|--------|---------------------------------|-------|--------------------------------------|
| POST   | `/auth/login`                   | -     | Returns `{ user, token }`            |
| POST   | `/auth/register`                | ADMIN | Creates an account (any role)        |
| GET    | `/auth/me`                      | any   | Current user                         |
| POST   | `/auth/logout`                  | any   | Stateless logout (client clears JWT) |

## Dashboards

| Method | Endpoint                      | Roles    |
|--------|-------------------------------|----------|
| GET    | `/admin/dashboard`            | ADMIN    |
| GET    | `/teacher/dashboard`          | TEACHER  |
| GET    | `/parent/dashboard`           | PARENT   |
| GET    | `/student/dashboard`          | STUDENT  |

Returns role-specific stats and curated lists for the dashboard widgets.

## Reports

| Method | Endpoint                                 | Roles                           |
|--------|------------------------------------------|---------------------------------|
| GET    | `/reports/class/:classId`                | ADMIN, TEACHER                  |
| GET    | `/reports/class/:classId/export`         | ADMIN, TEACHER (CSV)            |
| GET    | `/reports/student/:studentId`            | ADMIN, TEACHER, PARENT, STUDENT |
| GET    | `/reports/teacher-workload`              | ADMIN                           |

Class report payload (excerpt):

```json
{
  "success": true,
  "data": {
    "class": { "id": 2, "name": "Secondary 1", "room": "S-201", "level": "SECONDARY" },
    "studentsCount": 2,
    "subjectAverages": [
      { "subjectId": 1, "subjectTitle": "Mathematics", "average": 15, "gradesCount": 2 }
    ],
    "attendanceSummary": { "PRESENT": 3, "ABSENT": 1, "LATE": 0, "EXCUSED": 0 },
    "overallAverage": 15,
    "weightedAverage": 15.5
  }
}
```

## Users (admin)

| Method | Endpoint                          | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/users`                          | List users                           |
| POST   | `/users/provision/student`        | Create student + parent (auto pwd)   |
| POST   | `/users/provision/teacher`        | Create teacher (auto pwd)            |
| PATCH  | `/users/:id/role`                 | Change a user's role                 |

## Students

| Method | Endpoint                         | Roles                  |
|--------|----------------------------------|------------------------|
| GET    | `/students`                      | ADMIN, TEACHER         |
| GET    | `/students/me/children`          | PARENT                 |
| GET    | `/students/:id`                  | ADMIN, TEACHER, PARENT, STUDENT |
| GET    | `/students/:id/progress`         | ADMIN, TEACHER, PARENT, STUDENT |
| POST   | `/students`                      | ADMIN                  |
| POST   | `/students/:id/parents`          | ADMIN, TEACHER         |
| DELETE | `/students/:id`                  | ADMIN                  |

## Teachers

| Method | Endpoint                | Roles  |
|--------|-------------------------|--------|
| GET    | `/teachers`             | ADMIN  |
| GET    | `/teachers/:id`         | ADMIN  |
| POST   | `/teachers`             | ADMIN  |
| DELETE | `/teachers/:id`         | ADMIN  |

## Classes

| Method | Endpoint                                       | Roles  |
|--------|------------------------------------------------|--------|
| GET    | `/classes`                                     | any (filtered) |
| GET    | `/classes/:id`                                 | any |
| POST   | `/classes`                                     | ADMIN |
| PUT    | `/classes/:id`                                 | ADMIN |
| DELETE | `/classes/:id`                                 | ADMIN |
| POST   | `/classes/:id/students`                        | ADMIN |
| DELETE | `/classes/:id/students/:studentId`             | ADMIN |
| POST   | `/classes/:id/teachers`                        | ADMIN |
| DELETE | `/classes/:id/teachers/:teacherId`             | ADMIN |

## Academic Years

| Method | Endpoint                       | Roles  |
|--------|--------------------------------|--------|
| GET    | `/academic-years`              | any    |
| POST   | `/academic-years`              | ADMIN  |
| PATCH  | `/academic-years/:id`          | ADMIN  |
| PATCH  | `/academic-years/:id/archive`  | ADMIN  |
| PATCH  | `/academic-years/:id/restore` | ADMIN  |
| DELETE | `/academic-years/:id`          | ADMIN  |

Query params for `GET`:

- Default: non-archived years only
- `?includeArchived=true` — all years (active + archived)
- `?archived=true` — archived years only

To activate a year, send `PATCH /academic-years/:id` with `{ "isActive": true }`. Only one non-archived year can be active at a time.

Archiving sets `isArchived` and `archivedAt` while preserving all linked classes, grades, attendance, assignments, and reports as read-only history. Archived years cannot be edited or deleted.

## AI Assistant (all authenticated roles)

Role-based data scoping: ADMIN (full school), TEACHER (assigned classes), PARENT (linked children), STUDENT (own data).

**Dual mode (automatic intent detection):**
- School-related questions → database context for the user’s role
- General questions → OpenAI without school data (requires `OPENAI_API_KEY`)
- Mixed questions → both sources combined

Works in school-only mode without OpenAI; General AI requires the API key.

| Method | Endpoint                    | Roles  |
|--------|-----------------------------|--------|
| GET    | `/ai/capabilities`          | any authenticated |
| GET    | `/ai/status`                | any authenticated |
| GET    | `/ai/dashboard-stats`       | any authenticated |
| GET    | `/ai/sessions`              | any authenticated |
| GET    | `/ai/sessions/:id`          | any authenticated |
| DELETE | `/ai/sessions/:id`          | any authenticated |
| POST   | `/ai/chat`                  | any authenticated |
| GET    | `/ai/reports`               | any authenticated |
| GET    | `/ai/reports/:id`           | any authenticated |
| POST   | `/ai/reports/generate`      | any authenticated (role-limited report types) |

Chat body:

```json
{ "message": "How many students are registered?", "sessionId": 1 }
```

`sessionId` is optional; omit to start a new conversation.

Report generation body:

```json
{ "reportType": "ATTENDANCE_MONTHLY" }
```

Report types by role:

- **ADMIN:** `ATTENDANCE_MONTHLY`, `STUDENT_ENROLLMENT`, `TEACHER_WORKLOAD`, `UNPAID_FEES`
- **TEACHER:** `LESSON_PLAN`, `CLASS_QUIZ`, `CLASS_HOMEWORK`, `CLASS_PERFORMANCE`
- **PARENT:** `CHILD_PROGRESS`, `CHILD_ATTENDANCE`
- **STUDENT:** `STUDY_PLAN`, `REVISION_PLAN`

## Subjects (Course == Subject)

| Method | Endpoint               | Roles  |
|--------|------------------------|--------|
| GET    | `/subjects`            | any    |
| GET    | `/subjects/:id`        | any    |
| POST   | `/subjects`            | ADMIN  |
| PUT    | `/subjects/:id`        | ADMIN  |
| DELETE | `/subjects/:id`        | ADMIN  |

Body example:

```json
{ "title": "Mathematics", "code": "MATH", "coefficient": 4, "levelTag": "SECONDARY" }
```

## Teaching Assignments

| Method | Endpoint                          | Roles  |
|--------|-----------------------------------|--------|
| GET    | `/teaching-assignments`           | ADMIN  |
| POST   | `/teaching-assignments`           | ADMIN  |
| DELETE | `/teaching-assignments/:id`       | ADMIN  |

Body:

```json
{ "teacherId": 1, "classId": 2, "courseId": 3 }
```

## Teacher workspace

| Method | Endpoint                                            | Roles    |
|--------|-----------------------------------------------------|----------|
| GET    | `/teacher/classes`                                  | TEACHER  |
| GET    | `/teacher/classes/:classId/students`                | TEACHER  |
| GET    | `/teacher/classes/:classId/subjects`                | TEACHER  |

## Grades

| Method | Endpoint                                                   | Roles                    |
|--------|------------------------------------------------------------|--------------------------|
| POST   | `/grades`                                                  | ADMIN, TEACHER           |
| POST   | `/grades/bulk-upsert`                                      | ADMIN, TEACHER           |
| GET    | `/grades/student/:studentId`                               | any (with restrictions)  |
| GET    | `/grades/student/:studentId/average`                       | any (with restrictions)  |
| GET    | `/grades/student/:studentId/export`                        | ADMIN, TEACHER (CSV)     |
| GET    | `/grades/class/:classId/average`                           | ADMIN, TEACHER, PARENT   |

`bulk-upsert` body:

```json
{
  "classId": 2,
  "courseId": 1,
  "title": "Algebra mid-term",
  "type": "EXAM",
  "date": "2026-10-15",
  "grades": [
    { "studentId": 4, "score": 16 },
    { "studentId": 5, "score": 12 }
  ]
}
```

## Attendance

| Method | Endpoint                          | Roles                    |
|--------|-----------------------------------|--------------------------|
| POST   | `/attendance`                     | ADMIN, TEACHER           |
| POST   | `/attendance/bulk-upsert`         | ADMIN, TEACHER           |
| GET    | `/attendance/student/:studentId`  | any (with restrictions)  |
| PATCH  | `/attendance/:id/justify`         | ADMIN, TEACHER, PARENT   |

`bulk-upsert` body:

```json
{
  "classId": 2,
  "courseId": 1,
  "date": "2026-10-15T08:00:00.000Z",
  "records": [
    { "studentId": 4, "status": "PRESENT" },
    { "studentId": 5, "status": "ABSENT", "justification": "Sick" }
  ]
}
```

## Assignments

| Method | Endpoint                                       | Roles                       |
|--------|------------------------------------------------|-----------------------------|
| POST   | `/assignments`                                 | ADMIN, TEACHER              |
| GET    | `/assignments/course/:courseId`                | ADMIN, TEACHER, STUDENT     |
| POST   | `/assignments/:assignmentId/submissions`       | STUDENT                     |
| GET    | `/assignments/:assignmentId/submissions`       | ADMIN, TEACHER              |

## Courses & materials

| Method | Endpoint                                 | Roles                       |
|--------|------------------------------------------|-----------------------------|
| GET    | `/courses`                               | ADMIN, TEACHER, STUDENT     |
| POST   | `/courses`                               | ADMIN, TEACHER              |
| GET    | `/courses/materials`                     | any (filtered)              |
| GET    | `/courses/:courseId/materials`           | any                         |
| POST   | `/courses/:courseId/materials`           | ADMIN, TEACHER              |
| DELETE | `/courses/materials/:id`                 | ADMIN, TEACHER              |

## Announcements

| Method | Endpoint           | Roles                                  |
|--------|--------------------|----------------------------------------|
| GET    | `/announcements`   | any (filtered for parents/students)    |
| POST   | `/announcements`   | ADMIN, TEACHER                         |

Body example:

```json
{
  "title": "Parent-teacher meeting",
  "content": "Saturday at 10:00",
  "targetRole": "PARENT",
  "classId": null
}
```

## Messages

| Method | Endpoint                  | Roles                  |
|--------|---------------------------|------------------------|
| GET    | `/messages`               | ADMIN, TEACHER, PARENT |
| GET    | `/messages/inbox`         | ADMIN, TEACHER, PARENT |
| GET    | `/messages/sent`          | ADMIN, TEACHER, PARENT |
| GET    | `/messages/contacts`      | ADMIN, TEACHER, PARENT |
| POST   | `/messages`               | ADMIN, TEACHER, PARENT |
| PATCH  | `/messages/:id/read`      | ADMIN, TEACHER, PARENT |

Non-admin users can only message TEACHER↔PARENT.

## Notifications

| Method | Endpoint                                | Roles |
|--------|-----------------------------------------|-------|
| GET    | `/notifications/me`                     | any   |
| PATCH  | `/notifications/:id/read`               | any   |
| PATCH  | `/notifications/me/read-all`            | any   |

## Audit (admin)

| Method | Endpoint                  | Roles |
|--------|---------------------------|-------|
| GET    | `/audit?limit=100`        | ADMIN |
