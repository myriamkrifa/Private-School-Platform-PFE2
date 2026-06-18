const bcrypt = require('bcryptjs')
const prisma = require('../src/prisma')

async function main() {
  const email = 'parent.12345999@school.com'
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.log('Parent not found')
    return
  }
  const plainPassword = `Parent@${String(user.identityCardNumber || '12345999').trim().toUpperCase()}`
  const hashedPassword = await bcrypt.hash(plainPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, isFirstLogin: true }
  })
  console.log(`Reset ${email} -> ${plainPassword}`)
}

main().finally(async () => prisma.$disconnect())
