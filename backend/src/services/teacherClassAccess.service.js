const prisma = require('../prisma')

const getTeacherProfileId = async (userId) => {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: Number(userId) },
    select: { id: true }
  })
  return teacher?.id ?? null
}

const getTeacherClassIds = async (teacherProfileId) => {
  if (!teacherProfileId) return []

  const [assignments, linkedClasses] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { teacherId: teacherProfileId },
      select: { classId: true }
    }),
    prisma.class.findMany({
      where: { teachers: { some: { id: teacherProfileId } } },
      select: { id: true }
    })
  ])

  return Array.from(
    new Set([
      ...assignments.map((row) => row.classId),
      ...linkedClasses.map((row) => row.id)
    ])
  )
}

const teacherHasClassAccess = async (teacherProfileId, classId) => {
  const classIds = await getTeacherClassIds(teacherProfileId)
  return classIds.includes(Number(classId))
}

const teacherIsDirectlyLinkedToClass = async (teacherProfileId, classId) => {
  const linked = await prisma.class.findFirst({
    where: {
      id: Number(classId),
      teachers: { some: { id: teacherProfileId } }
    },
    select: { id: true }
  })
  return Boolean(linked)
}

const uniqueCoursesFromAssignments = (assignments = []) => {
  const byId = new Map()
  assignments.forEach((row) => {
    if (row.course?.id) byId.set(row.course.id, row.course)
  })
  return Array.from(byId.values())
}

const getClassCourseIds = async (classId) => {
  const parsedClassId = Number(classId)
  const [assignments, courses] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { classId: parsedClassId },
      select: { courseId: true }
    }),
    prisma.course.findMany({
      where: { classId: parsedClassId },
      select: { id: true }
    })
  ])
  return new Set([
    ...assignments.map((row) => row.courseId),
    ...courses.map((row) => row.id)
  ])
}

const getSubjectsForTeacherClass = async (teacherProfileId, classId) => {
  const parsedClassId = Number(classId)
  const ownAssignments = await prisma.teachingAssignment.findMany({
    where: { teacherId: teacherProfileId, classId: parsedClassId },
    include: { course: { select: { id: true, title: true, code: true } } }
  })
  if (ownAssignments.length > 0) {
    return uniqueCoursesFromAssignments(ownAssignments)
  }

  const classAssignments = await prisma.teachingAssignment.findMany({
    where: { classId: parsedClassId },
    include: { course: { select: { id: true, title: true, code: true } } }
  })
  if (classAssignments.length > 0) {
    return uniqueCoursesFromAssignments(classAssignments)
  }

  const classCourses = await prisma.course.findMany({
    where: { classId: parsedClassId },
    select: { id: true, title: true, code: true },
    orderBy: { title: 'asc' }
  })
  if (classCourses.length > 0) {
    return classCourses
  }

  const directlyLinked = await teacherIsDirectlyLinkedToClass(teacherProfileId, parsedClassId)
  if (directlyLinked) {
    return prisma.course.findMany({
      select: { id: true, title: true, code: true },
      orderBy: { title: 'asc' }
    })
  }

  return []
}

const teacherCanMarkClassSubject = async (teacherProfileId, classId, courseId) => {
  const parsedClassId = Number(classId)
  const parsedCourseId = Number(courseId)

  const hasClassAccess = await teacherHasClassAccess(teacherProfileId, parsedClassId)
  if (!hasClassAccess) return false

  const ownAssignment = await prisma.teachingAssignment.findUnique({
    where: {
      teacherId_classId_courseId: {
        teacherId: teacherProfileId,
        classId: parsedClassId,
        courseId: parsedCourseId
      }
    }
  })
  if (ownAssignment) return true

  const directlyLinked = await teacherIsDirectlyLinkedToClass(teacherProfileId, parsedClassId)
  if (!directlyLinked) return false

  const classCourseIds = await getClassCourseIds(parsedClassId)
  if (classCourseIds.has(parsedCourseId)) return true

  if (classCourseIds.size === 0) {
    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: { id: true }
    })
    return Boolean(course)
  }

  return false
}

module.exports = {
  getTeacherProfileId,
  getTeacherClassIds,
  teacherHasClassAccess,
  getSubjectsForTeacherClass,
  teacherCanMarkClassSubject
}
