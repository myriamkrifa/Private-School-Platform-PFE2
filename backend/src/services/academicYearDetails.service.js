const buildYearDetailsPayload = (year) => {
  const classes = year.classes || []
  const studentMap = new Map()
  const parentMap = new Map()
  const teacherMap = new Map()
  const courseMap = new Map()
  const teachingAssignments = []

  let assignmentCount = 0
  let gradeRecordCount = 0
  let attendanceCount = 0

  const classesSummary = classes.map((klass) => {
    assignmentCount += klass._count?.assignments || 0
    gradeRecordCount += klass._count?.grades || 0
    attendanceCount += klass._count?.attendances || 0

    for (const student of klass.students || []) {
      if (!studentMap.has(student.id)) {
        studentMap.set(student.id, {
          id: student.id,
          name: student.name,
          email: student.email,
          grade: student.grade,
          status: student.status,
          className: klass.name,
          classId: klass.id
        })
      }

      for (const link of student.parentLinks || []) {
        const parent = link.parent
        if (!parent) continue

        if (!parentMap.has(parent.id)) {
          parentMap.set(parent.id, {
            id: parent.id,
            name: parent.name,
            email: parent.email,
            phoneNumber: parent.phoneNumber,
            identityCardNumber: parent.identityCardNumber,
            children: []
          })
        }

        const parentEntry = parentMap.get(parent.id)
        if (!parentEntry.children.some((child) => child.id === student.id)) {
          parentEntry.children.push({
            id: student.id,
            name: student.name,
            className: klass.name
          })
        }
      }
    }

    for (const teacher of klass.teachers || []) {
      if (!teacherMap.has(teacher.id)) {
        teacherMap.set(teacher.id, {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          subject: teacher.subject,
          phone: teacher.phone,
          status: teacher.status,
          classes: [{ id: klass.id, name: klass.name }]
        })
      } else {
        const teacherEntry = teacherMap.get(teacher.id)
        if (!teacherEntry.classes.some((item) => item.id === klass.id)) {
          teacherEntry.classes.push({ id: klass.id, name: klass.name })
        }
      }
    }

    for (const course of klass.courses || []) {
      const key = `${klass.id}-${course.id}`
      if (!courseMap.has(key)) {
        courseMap.set(key, {
          id: course.id,
          title: course.title,
          code: course.code,
          coefficient: course.coefficient,
          className: klass.name,
          classId: klass.id
        })
      }
    }

    for (const assignment of klass.teachingAssignments || []) {
      teachingAssignments.push({
        id: assignment.id,
        className: klass.name,
        classId: klass.id,
        teacherName: assignment.teacher?.name || '—',
        teacherEmail: assignment.teacher?.email || '—',
        courseTitle: assignment.course?.title || '—',
        courseCode: assignment.course?.code || '—'
      })
    }

    return {
      id: klass.id,
      name: klass.name,
      room: klass.room,
      grade: klass.grade,
      level: klass.level,
      capacity: klass.capacity,
      studentCount: klass._count?.students || 0,
      teacherCount: klass._count?.teachers || 0,
      courseCount: klass._count?.courses || 0,
      assignmentCount: klass._count?.assignments || 0,
      gradeRecordCount: klass._count?.grades || 0,
      attendanceCount: klass._count?.attendances || 0
    }
  })

  const { classes: _classes, ...yearMeta } = year

  return {
    ...yearMeta,
    summary: {
      classes: classes.length,
      students: studentMap.size,
      teachers: teacherMap.size,
      parents: parentMap.size,
      courses: courseMap.size,
      teachingAssignments: teachingAssignments.length,
      assignments: assignmentCount,
      gradeRecords: gradeRecordCount,
      attendances: attendanceCount
    },
    classes: classesSummary,
    students: Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    parents: Array.from(parentMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    teachers: Array.from(teacherMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    courses: Array.from(courseMap.values()).sort((a, b) => a.title.localeCompare(b.title)),
    teachingAssignments: teachingAssignments.sort((a, b) => {
      const byClass = a.className.localeCompare(b.className)
      if (byClass !== 0) return byClass
      return a.courseTitle.localeCompare(b.courseTitle)
    })
  }
}

const yearDetailsInclude = {
  classes: {
    include: {
      students: {
        select: {
          id: true,
          name: true,
          email: true,
          grade: true,
          status: true,
          parentLinks: {
            include: {
              parent: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNumber: true,
                  identityCardNumber: true
                }
              }
            }
          }
        },
        orderBy: { name: 'asc' }
      },
      teachers: {
        select: {
          id: true,
          name: true,
          email: true,
          subject: true,
          phone: true,
          status: true
        },
        orderBy: { name: 'asc' }
      },
      courses: {
        select: {
          id: true,
          title: true,
          code: true,
          coefficient: true
        },
        orderBy: { title: 'asc' }
      },
      teachingAssignments: {
        include: {
          teacher: { select: { id: true, name: true, email: true, subject: true } },
          course: { select: { id: true, title: true, code: true } }
        }
      },
      _count: {
        select: {
          students: true,
          teachers: true,
          courses: true,
          assignments: true,
          grades: true,
          attendances: true
        }
      }
    },
    orderBy: [{ level: 'asc' }, { name: 'asc' }]
  }
}

module.exports = {
  buildYearDetailsPayload,
  yearDetailsInclude
}
