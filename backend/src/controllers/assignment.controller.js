const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')

const getTeacherProfileId = async (userId) => {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: Number(userId) },
    select: { id: true }
  })
  return teacher?.id || null
}

const notifyTargets = async (assignment, recipientIds) => {
  let userIds = []
  if (assignment.targetType === 'SELECTED_STUDENTS' && recipientIds.length > 0) {
    const students = await prisma.student.findMany({
      where: { id: { in: recipientIds } },
      select: { userId: true }
    })
    userIds = students.map((s) => s.userId).filter(Boolean)
  } else if (assignment.classId) {
    const students = await prisma.student.findMany({
      where: { classId: assignment.classId },
      select: { userId: true }
    })
    userIds = students.map((s) => s.userId).filter(Boolean)
  }

  if (userIds.length > 0) {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: 'ASSIGNMENT',
        title: 'New assignment',
        message: `${assignment.title} - due ${new Date(assignment.dueDate).toLocaleDateString()}`
      }))
    })
  }
}

exports.createAssignment = async (req, res) => {
  try {
    const {
      classId,
      courseId,
      subjectId,
      title,
      description,
      dueDate,
      deadline,
      targetType,
      studentIds = []
    } = req.body

    const effectiveCourseId = courseId ?? subjectId
    const effectiveDue = dueDate ?? deadline

    if (!classId || !effectiveCourseId || !title || !effectiveDue) {
      return res.status(400).json({ message: 'Please provide classId, courseId/subjectId, title, and dueDate/deadline.' })
    }

    const parsedClassId = Number.parseInt(classId, 10)
    const parsedCourseId = Number.parseInt(effectiveCourseId, 10)
    const due = new Date(effectiveDue)
    if (Number.isNaN(due.getTime())) {
      return res.status(400).json({ message: 'Invalid deadline date.' })
    }

    if (req.user?.role === 'TEACHER') {
      const teacherProfileId = await getTeacherProfileId(req.user.id)
      const allowed = await prisma.teachingAssignment.findUnique({
        where: {
          teacherId_classId_courseId: {
            teacherId: teacherProfileId,
            classId: parsedClassId,
            courseId: parsedCourseId
          }
        }
      })
      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to this class/subject.' })
      }
    }

    let resolvedTarget = targetType
    if (!resolvedTarget) {
      resolvedTarget = studentIds.length > 0 ? 'SELECTED_STUDENTS' : 'FULL_CLASS'
    }
    if (!['FULL_CLASS', 'SELECTED_STUDENTS'].includes(resolvedTarget)) {
      return res.status(400).json({ message: 'targetType must be FULL_CLASS or SELECTED_STUDENTS.' })
    }

    const recipients = resolvedTarget === 'SELECTED_STUDENTS'
      ? studentIds.map((id) => Number(id))
      : []

    if (recipients.length > 0) {
      const validCount = await prisma.student.count({
        where: { id: { in: recipients }, classId: parsedClassId }
      })
      if (validCount !== recipients.length) {
        return res.status(400).json({ message: 'One or more selected students do not belong to this class.' })
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        classId: parsedClassId,
        courseId: parsedCourseId,
        teacherId: req.user?.id,
        title,
        description: description || null,
        dueDate: due,
        targetType: resolvedTarget,
        recipients: {
          create: recipients.map((studentId) => ({ studentId }))
        }
      },
      include: { recipients: { select: { studentId: true } } }
    })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'ASSIGNMENT_CREATE',
      entityType: 'Assignment',
      entityId: assignment.id,
      after: { title: assignment.title, classId: assignment.classId, courseId: assignment.courseId }
    })
    await notifyTargets(assignment, recipients)

    return res.status(201).json({ success: true, data: assignment, message: 'Assignment created.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error creating assignment.', error: error.message })
  }
}

exports.getCourseAssignments = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10)
    let assignments = await prisma.assignment.findMany({
      where: { courseId },
      include: {
        recipients: { select: { studentId: true } },
        class: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } }
      },
      orderBy: { dueDate: 'asc' }
    })

    if (req.user?.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { id: true, classId: true }
      })
      if (!student) return res.json({ success: true, data: [] })
      assignments = assignments.filter((item) =>
        (item.targetType === 'FULL_CLASS' && item.classId === student.classId) ||
        item.recipients.some((r) => r.studentId === student.id)
      )
    }

    return res.json({ success: true, data: assignments })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching assignments.', error: error.message })
  }
}

exports.getTeacherAssignments = async (req, res) => {
  try {
    const teacherId = req.user?.id
    const assignments = await prisma.assignment.findMany({
      where: { teacherId },
      include: {
        class: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        recipients: { select: { studentId: true } },
        _count: { select: { submissions: true } }
      },
      orderBy: { dueDate: 'asc' }
    })
    return res.json({ success: true, data: assignments })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching teacher assignments.', error: error.message })
  }
}

exports.deleteAssignment = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { _count: { select: { submissions: true } } }
    })
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' })
    }
    if (assignment._count.submissions > 0) {
      return res.status(400).json({ message: 'Cannot delete an assignment that has submissions.' })
    }
    await prisma.assignment.delete({ where: { id } })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'ASSIGNMENT_DELETE',
      entityType: 'Assignment',
      entityId: id
    })
    return res.json({ success: true, message: 'Assignment deleted.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting assignment.', error: error.message })
  }
}

exports.submitAssignment = async (req, res) => {
  try {
    const assignmentId = Number.parseInt(req.params.assignmentId, 10)
    let { studentId, content, fileUrl } = req.body

    // If a STUDENT is submitting without specifying studentId, infer from user.
    if (req.user?.role === 'STUDENT' && !studentId) {
      const profile = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { id: true }
      })
      studentId = profile?.id
    }
    if (!studentId) {
      return res.status(400).json({ message: 'Please provide studentId.' })
    }

    const submission = await prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId: Number(studentId) } },
      create: {
        assignmentId,
        studentId: Number(studentId),
        content: content || null,
        fileUrl: fileUrl || null
      },
      update: {
        content: content || null,
        fileUrl: fileUrl || null,
        submittedAt: new Date()
      }
    })

    return res.status(201).json({ success: true, data: submission, message: 'Submission saved.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error submitting assignment.', error: error.message })
  }
}

exports.getAssignmentSubmissions = async (req, res) => {
  try {
    const assignmentId = Number.parseInt(req.params.assignmentId, 10)
    const submissions = await prisma.submission.findMany({
      where: { assignmentId },
      include: { student: { select: { id: true, name: true, email: true } } },
      orderBy: { submittedAt: 'desc' }
    })
    return res.json({ success: true, data: submissions })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching submissions.', error: error.message })
  }
}
