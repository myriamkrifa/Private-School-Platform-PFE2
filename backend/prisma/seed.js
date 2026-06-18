/**
 * Standalone seed: primary Admin account (safe to re-run).
 */
require('dotenv').config()
const bcrypt = require('bcryptjs')
const prisma = require('../src/prisma')

const ADMIN = {
  name: 'Mariem Krifa',
  email: 'mariem.krifa@horizon-tech.tn',
  role: 'ADMIN',
  plaintextPassword: 'password123',
  isActive: true
}

const DEFAULT_SUBJECTS = [
  { title: 'Mathematics', code: 'MATH', coefficient: 4 },
  { title: 'French', code: 'FR', coefficient: 3 },
  { title: 'English', code: 'EN', coefficient: 3 },
  { title: 'Science', code: 'SCI', coefficient: 3 },
  { title: 'History', code: 'HIST', coefficient: 2 },
  { title: 'Sport', code: 'SPORT', coefficient: 1 },
  { title: 'Computer Science', code: 'CS', coefficient: 3 },
  { title: 'Physics', code: 'PHYS', coefficient: 4 },
  { title: 'Philosophy', code: 'PHIL', coefficient: 2 }
]

async function seedSubjects() {
  for (const subject of DEFAULT_SUBJECTS) {
    const existing = await prisma.course.findFirst({
      where: {
        OR: [
          { code: subject.code },
          { title: subject.title }
        ]
      }
    })

    if (existing) {
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          title: subject.title,
          code: subject.code,
          coefficient: subject.coefficient
        }
      })
      console.log(`   Updated subject: ${subject.title} (${subject.code})`)
    } else {
      await prisma.course.create({ data: subject })
      console.log(`   Created subject: ${subject.title} (${subject.code})`)
    }
  }
}

async function main() {
  const hashedPassword = bcrypt.hashSync(ADMIN.plaintextPassword, 10)

  const user = await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: {
      name: ADMIN.name,
      password: hashedPassword,
      role: ADMIN.role,
      isActive: ADMIN.isActive
    },
    create: {
      name: ADMIN.name,
      email: ADMIN.email,
      password: hashedPassword,
      role: ADMIN.role,
      isActive: ADMIN.isActive
    }
  })

  console.log('\n✅ Primary admin account ready')
  console.log('   Name:    ', user.name)
  console.log('   Email:   ', user.email)
  console.log('   Role:    ', user.role)
  console.log('   Active:  ', user.isActive)
  console.log('   Password:', ADMIN.plaintextPassword, '(plaintext for local dev only)\n')

  console.log('📚 Default subjects')
  await seedSubjects()
  console.log('')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
