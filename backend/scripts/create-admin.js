const bcrypt = require('bcryptjs')
const prisma = require('../src/prisma')

async function main() {
  const email = 'admin@school.com'
  const plainPassword = 'Admin@1234'

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    const hashedReset = await bcrypt.hash(plainPassword, 10)
    const updated = await prisma.user.update({
      where: { email },
      data: {
        role: 'ADMIN',
        password: hashedReset,
        mustChangePassword: false
      },
      select: { id: true, name: true, email: true, role: true }
    })
    console.log('Admin account already existed. Password has been reset.')
    console.log(updated)
    console.log(`Login email:    ${email}`)
    console.log(`Login password: ${plainPassword}`)
    return
  }

  const hashed = await bcrypt.hash(plainPassword, 10)

  const admin = await prisma.user.create({
    data: {
      name: 'Administrator',
      email,
      password: hashed,
      role: 'ADMIN',
      mustChangePassword: false
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  })

  console.log('Admin account created:')
  console.log(admin)
  console.log(`Login email:    ${email}`)
  console.log(`Login password: ${plainPassword}`)
}

main()
  .catch((error) => {
    console.error('Failed to create admin account:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
