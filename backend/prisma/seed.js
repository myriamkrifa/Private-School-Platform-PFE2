/**
 * Demo seed for the Private School Management Platform.
 *
 * Creates an active academic year, primary + secondary classes, 5 subjects,
 * 2 teachers with teaching assignments, 2 parents linked to 4 students,
 * grades, attendance records, an assignment, announcements, notifications,
 * and a sample teacher↔parent message thread.
 */
const bcrypt = require('bcryptjs')
const prisma = require('../src/prisma')

const DEMO_PASSWORD = 'password123'

const days = (offset) => {
  const date = new Date()
  date.setHours(8, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return date
}

async function main() {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10)

  // 1) Wipe existing data in dependency-safe order
  await prisma.notification.deleteMany()
  await prisma.message.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.submission.deleteMany()
  await prisma.assignmentRecipient.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.grade.deleteMany()
  await prisma.teachingAssignment.deleteMany()
  await prisma.courseMaterial.deleteMany()
  await prisma.course.deleteMany()
  await prisma.parentStudent.deleteMany()
  await prisma.student.deleteMany()
  await prisma.teacher.deleteMany()
  await prisma.class.deleteMany()
  await prisma.academicYear.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.user.deleteMany()

  // 2) Users
  const admin = await prisma.user.create({
    data: { name: 'School Admin', email: 'admin@school.com', password, role: 'ADMIN' }
  })

  const mathTeacherUser = await prisma.user.create({
    data: { name: 'Mr. Khaled (Math)', email: 'teacher.math@school.com', password, role: 'TEACHER' }
  })
  const frenchTeacherUser = await prisma.user.create({
    data: { name: 'Mme. Aida (French)', email: 'teacher.french@school.com', password, role: 'TEACHER' }
  })

  const parentAli = await prisma.user.create({
    data: {
      name: 'Mr. Ali Ben Salah',
      email: 'parent.ali@school.com',
      password,
      role: 'PARENT',
      phoneNumber: '+216 22 111 222'
    }
  })
  const parentSara = await prisma.user.create({
    data: {
      name: 'Mrs. Sara Trabelsi',
      email: 'parent.sara@school.com',
      password,
      role: 'PARENT',
      phoneNumber: '+216 22 333 444'
    }
  })

  const studentYoussefUser = await prisma.user.create({
    data: { name: 'Youssef Ben Salah', email: 'student.youssef@school.com', password, role: 'STUDENT' }
  })
  const studentMariemUser = await prisma.user.create({
    data: { name: 'Mariem Trabelsi', email: 'student.mariem@school.com', password, role: 'STUDENT' }
  })
  const studentAmineUser = await prisma.user.create({
    data: { name: 'Amine Ben Salah', email: 'student.amine@school.com', password, role: 'STUDENT' }
  })
  const studentNourUser = await prisma.user.create({
    data: { name: 'Nour Trabelsi', email: 'student.nour@school.com', password, role: 'STUDENT' }
  })

  // 3) Teacher profiles
  const mathTeacher = await prisma.teacher.create({
    data: {
      userId: mathTeacherUser.id,
      name: mathTeacherUser.name,
      email: mathTeacherUser.email,
      subject: 'Mathematics',
      specialty: 'Mathematics',
      phone: '+216 71 000 111'
    }
  })
  const frenchTeacher = await prisma.teacher.create({
    data: {
      userId: frenchTeacherUser.id,
      name: frenchTeacherUser.name,
      email: frenchTeacherUser.email,
      subject: 'French',
      specialty: 'French Language',
      phone: '+216 71 000 222'
    }
  })

  // 4) Active academic year
  const year = await prisma.academicYear.create({
    data: {
      name: '2026-2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
      isActive: true
    }
  })

  // 5) Classes
  const primary1 = await prisma.class.create({
    data: {
      name: 'Primary 1',
      room: 'P-101',
      level: 'PRIMARY',
      capacity: 30,
      description: 'Primary year 1 - homeroom A.',
      academicYearId: year.id
    }
  })
  const secondary1 = await prisma.class.create({
    data: {
      name: 'Secondary 1',
      room: 'S-201',
      level: 'SECONDARY',
      capacity: 28,
      description: 'Secondary year 1 - science track.',
      academicYearId: year.id
    }
  })
  const secondary2 = await prisma.class.create({
    data: {
      name: 'Secondary 2',
      room: 'S-202',
      level: 'SECONDARY',
      capacity: 28,
      description: 'Secondary year 2 - literary track.',
      academicYearId: year.id
    }
  })

  // 6) Subjects (Course == Subject in this codebase)
  const subjectData = [
    { title: 'Mathematics', code: 'MATH', coefficient: 4, levelTag: 'SECONDARY', teacherId: mathTeacherUser.id },
    { title: 'French',      code: 'FR',   coefficient: 3, levelTag: null,         teacherId: frenchTeacherUser.id },
    { title: 'English',     code: 'EN',   coefficient: 2, levelTag: null,         teacherId: frenchTeacherUser.id },
    { title: 'Science',     code: 'SCI',  coefficient: 3, levelTag: 'SECONDARY',  teacherId: mathTeacherUser.id },
    { title: 'History',     code: 'HIST', coefficient: 2, levelTag: null,         teacherId: frenchTeacherUser.id }
  ]

  const subjects = {}
  for (const subject of subjectData) {
    const created = await prisma.course.create({
      data: {
        title: subject.title,
        code: subject.code,
        coefficient: subject.coefficient,
        levelTag: subject.levelTag,
        teacherId: subject.teacherId,
        description: `${subject.title} - core school subject.`
      }
    })
    subjects[subject.title] = created
  }

  // 7) Students linked to a class and to a parent
  const youssef = await prisma.student.create({
    data: {
      userId: studentYoussefUser.id,
      name: studentYoussefUser.name,
      email: studentYoussefUser.email,
      firstName: 'Youssef',
      lastName: 'Ben Salah',
      grade: 'Primary 1',
      classId: primary1.id,
      enrollmentDate: new Date('2026-09-01'),
      status: 'ACTIVE'
    }
  })
  const amine = await prisma.student.create({
    data: {
      userId: studentAmineUser.id,
      name: studentAmineUser.name,
      email: studentAmineUser.email,
      firstName: 'Amine',
      lastName: 'Ben Salah',
      grade: 'Secondary 1',
      classId: secondary1.id,
      enrollmentDate: new Date('2026-09-01'),
      status: 'ACTIVE'
    }
  })
  const mariem = await prisma.student.create({
    data: {
      userId: studentMariemUser.id,
      name: studentMariemUser.name,
      email: studentMariemUser.email,
      firstName: 'Mariem',
      lastName: 'Trabelsi',
      grade: 'Secondary 1',
      classId: secondary1.id,
      enrollmentDate: new Date('2026-09-01'),
      status: 'ACTIVE'
    }
  })
  const nour = await prisma.student.create({
    data: {
      userId: studentNourUser.id,
      name: studentNourUser.name,
      email: studentNourUser.email,
      firstName: 'Nour',
      lastName: 'Trabelsi',
      grade: 'Secondary 2',
      classId: secondary2.id,
      enrollmentDate: new Date('2026-09-01'),
      status: 'ACTIVE'
    }
  })

  // 8) Parent ↔ children links
  await prisma.parentStudent.createMany({
    data: [
      { parentId: parentAli.id, studentId: youssef.id },
      { parentId: parentAli.id, studentId: amine.id },
      { parentId: parentSara.id, studentId: mariem.id },
      { parentId: parentSara.id, studentId: nour.id }
    ]
  })

  // 9) Class ↔ teacher (M-N) for sidebar visibility
  await prisma.class.update({
    where: { id: primary1.id },
    data: { teachers: { connect: [{ id: mathTeacher.id }, { id: frenchTeacher.id }] } }
  })
  await prisma.class.update({
    where: { id: secondary1.id },
    data: { teachers: { connect: [{ id: mathTeacher.id }, { id: frenchTeacher.id }] } }
  })
  await prisma.class.update({
    where: { id: secondary2.id },
    data: { teachers: { connect: [{ id: frenchTeacher.id }] } }
  })

  // 10) Teaching assignments (teacher + class + subject)
  await prisma.teachingAssignment.createMany({
    data: [
      { teacherId: mathTeacher.id,   classId: primary1.id,   courseId: subjects['Mathematics'].id },
      { teacherId: frenchTeacher.id, classId: primary1.id,   courseId: subjects['French'].id },
      { teacherId: mathTeacher.id,   classId: secondary1.id, courseId: subjects['Mathematics'].id },
      { teacherId: mathTeacher.id,   classId: secondary1.id, courseId: subjects['Science'].id },
      { teacherId: frenchTeacher.id, classId: secondary1.id, courseId: subjects['French'].id },
      { teacherId: frenchTeacher.id, classId: secondary1.id, courseId: subjects['English'].id },
      { teacherId: frenchTeacher.id, classId: secondary2.id, courseId: subjects['French'].id },
      { teacherId: frenchTeacher.id, classId: secondary2.id, courseId: subjects['History'].id }
    ]
  })

  // 11) Sample grades
  await prisma.grade.createMany({
    data: [
      { studentId: youssef.id, classId: primary1.id,   courseId: subjects['Mathematics'].id, teacherId: mathTeacherUser.id,   subject: 'Mathematics', score: 16, maxScore: 20, type: 'TEST', title: 'Addition test' },
      { studentId: youssef.id, classId: primary1.id,   courseId: subjects['French'].id,      teacherId: frenchTeacherUser.id, subject: 'French',      score: 14, maxScore: 20, type: 'HOMEWORK', title: 'Reading comprehension' },
      { studentId: amine.id,   classId: secondary1.id, courseId: subjects['Mathematics'].id, teacherId: mathTeacherUser.id,   subject: 'Mathematics', score: 12, maxScore: 20, type: 'EXAM', title: 'Algebra mid-term' },
      { studentId: amine.id,   classId: secondary1.id, courseId: subjects['Science'].id,     teacherId: mathTeacherUser.id,   subject: 'Science',     score: 15, maxScore: 20, type: 'PROJECT', title: 'Solar system' },
      { studentId: mariem.id,  classId: secondary1.id, courseId: subjects['Mathematics'].id, teacherId: mathTeacherUser.id,   subject: 'Mathematics', score: 18, maxScore: 20, type: 'EXAM', title: 'Algebra mid-term' },
      { studentId: mariem.id,  classId: secondary1.id, courseId: subjects['French'].id,      teacherId: frenchTeacherUser.id, subject: 'French',      score: 17, maxScore: 20, type: 'ORAL', title: 'Reading aloud' },
      { studentId: nour.id,    classId: secondary2.id, courseId: subjects['French'].id,      teacherId: frenchTeacherUser.id, subject: 'French',      score: 13, maxScore: 20, type: 'TEST', title: 'Conjugation quiz' },
      { studentId: nour.id,    classId: secondary2.id, courseId: subjects['History'].id,     teacherId: frenchTeacherUser.id, subject: 'History',     score: 11, maxScore: 20, type: 'TEST', title: 'Ancient civilizations' }
    ]
  })

  // 12) Attendance records (today + yesterday)
  await prisma.attendance.createMany({
    data: [
      { studentId: youssef.id, classId: primary1.id,   courseId: subjects['Mathematics'].id, date: days(0),  status: 'PRESENT', takenById: mathTeacherUser.id },
      { studentId: youssef.id, classId: primary1.id,   courseId: subjects['French'].id,      date: days(-1), status: 'LATE',    takenById: frenchTeacherUser.id, comment: 'Bus delay' },
      { studentId: amine.id,   classId: secondary1.id, courseId: subjects['Mathematics'].id, date: days(0),  status: 'ABSENT',  takenById: mathTeacherUser.id, justification: 'Sick - doctor note pending' },
      { studentId: mariem.id,  classId: secondary1.id, courseId: subjects['Mathematics'].id, date: days(0),  status: 'PRESENT', takenById: mathTeacherUser.id },
      { studentId: mariem.id,  classId: secondary1.id, courseId: subjects['French'].id,      date: days(-1), status: 'EXCUSED', takenById: frenchTeacherUser.id, justification: 'School trip' },
      { studentId: nour.id,    classId: secondary2.id, courseId: subjects['French'].id,      date: days(0),  status: 'PRESENT', takenById: frenchTeacherUser.id }
    ]
  })

  // 13) Assignments
  const fullClassAssignment = await prisma.assignment.create({
    data: {
      classId: secondary1.id,
      courseId: subjects['Mathematics'].id,
      teacherId: mathTeacherUser.id,
      title: 'Algebra worksheet',
      description: 'Solve exercises 1 to 8 from chapter 3.',
      dueDate: days(7),
      targetType: 'FULL_CLASS'
    }
  })
  const targetedAssignment = await prisma.assignment.create({
    data: {
      classId: secondary1.id,
      courseId: subjects['Science'].id,
      teacherId: mathTeacherUser.id,
      title: 'Solar system mini-project',
      description: 'Selected students will present a poster next week.',
      dueDate: days(5),
      targetType: 'SELECTED_STUDENTS'
    }
  })
  await prisma.assignmentRecipient.createMany({
    data: [
      { assignmentId: targetedAssignment.id, studentId: amine.id },
      { assignmentId: targetedAssignment.id, studentId: mariem.id }
    ]
  })

  // 14) Course materials
  await prisma.courseMaterial.create({
    data: {
      courseId: subjects['Mathematics'].id,
      title: 'Algebra cheatsheet',
      description: 'Recap formulas for the upcoming test.',
      content: 'a^2 + 2ab + b^2 = (a+b)^2 ; (a-b)^2 = a^2 - 2ab + b^2 ; …'
    }
  })
  await prisma.courseMaterial.create({
    data: {
      courseId: subjects['French'].id,
      title: 'Conjugation reference',
      fileUrl: 'https://example.com/conjugation.pdf'
    }
  })

  // 15) Announcements
  await prisma.announcement.createMany({
    data: [
      {
        title: 'Welcome to the new academic year',
        content: 'Classes start on Monday. Schedules are available in your dashboard.',
        createdById: admin.id
      },
      {
        title: 'Parent-teacher meeting',
        content: 'A parent-teacher meeting is scheduled for next Saturday at 10:00 AM.',
        targetRole: 'PARENT',
        createdById: admin.id
      },
      {
        title: 'Math test next week (Secondary 1)',
        content: 'Reminder: Algebra test next Thursday. Please review chapters 1-3.',
        classId: secondary1.id,
        createdById: mathTeacherUser.id
      }
    ]
  })

  // 16) Notifications (one per common type)
  await prisma.notification.createMany({
    data: [
      { userId: parentAli.id,  type: 'GRADE',        title: 'New grade',        message: 'Youssef received a new grade in Mathematics.' },
      { userId: parentAli.id,  type: 'ABSENCE',      title: 'Absence recorded', message: 'Amine was marked absent today in Mathematics.' },
      { userId: parentSara.id, type: 'ANNOUNCEMENT', title: 'New announcement', message: 'Parent-teacher meeting scheduled for Saturday.' },
      { userId: studentMariemUser.id, type: 'ASSIGNMENT', title: 'New assignment', message: 'Algebra worksheet is due in 7 days.' }
    ]
  })

  // 17) Sample teacher ↔ parent message thread
  await prisma.message.create({
    data: {
      senderId: mathTeacherUser.id,
      recipientId: parentAli.id,
      subject: 'About Amine',
      content: 'Amine missed today\'s class. Could you confirm whether he is feeling well?'
    }
  })
  await prisma.message.create({
    data: {
      senderId: parentAli.id,
      recipientId: mathTeacherUser.id,
      subject: 'Re: About Amine',
      content: 'Thank you for letting me know. He has a doctor appointment, the note will follow tomorrow.'
    }
  })

  console.log('\n✅ Seed complete')
  console.log('Demo accounts (password = ' + DEMO_PASSWORD + ')')
  console.log(' - admin@school.com')
  console.log(' - teacher.math@school.com')
  console.log(' - teacher.french@school.com')
  console.log(' - parent.ali@school.com')
  console.log(' - parent.sara@school.com')
  console.log(' - student.youssef@school.com')
  console.log(' - student.mariem@school.com')
  console.log(' - student.amine@school.com')
  console.log(' - student.nour@school.com')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
