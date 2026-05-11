const { PrismaClient } = require('@prisma/client')

const GENERATE_HINT =
	'Prisma client appears to be out of sync or not generated. Run: npm run prisma:generate'

const createPrismaClient = () => {
	try {
		return new PrismaClient()
	} catch (error) {
		const isGenerateMismatch =
			error?.name === 'PrismaClientInitializationError' &&
			String(error?.message || '').includes('needs to be constructed with a non-empty, valid `PrismaClientOptions`')

		if (isGenerateMismatch) {
			error.message = `${error.message}\n\n${GENERATE_HINT}`
		}

		throw error
	}
}

const globalForPrisma = globalThis
const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma
}

module.exports = prisma
