// Test with hardcoded URL to bypass dotenv
process.env.DATABASE_URL = "postgresql://postgres:admin123@localhost:5432/school_db?schema=public"

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] })

async function main() {
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL)
    console.log('\nTesting connection...')
    const users = await prisma.user.findMany()
    console.log('SUCCESS! Users found:', users.length)
    console.log(JSON.stringify(users, null, 2))
  } catch (e) {
    console.log('\nERROR:', e.message)
    console.log('ERROR CODE:', e.code)
  } finally {
    await prisma.$disconnect()
  }
}

main()
