require('dotenv').config()

console.log('DATABASE_URL:', process.env.DATABASE_URL)

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({ log: ['error', 'warn'] })

async function main() {
  try {
    await prisma.$connect()
    console.log('SUCCESS: Connected to database!')
    const count = await prisma.user.count()
    console.log('User count:', count)
  } catch (e) {
    console.error('ERROR:', e.message)
    console.error('Full error:', JSON.stringify(e, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main()
