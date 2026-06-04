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
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
