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

const { AiReportType, Prisma } = require('@prisma/client')
const globalForPrisma = globalThis

const aiReportModel = Prisma?.dmmf?.datamodel?.models?.find((m) => m.name === 'AiGeneratedReport')
const hasPublishedAtField = aiReportModel?.fields?.some((f) => f.name === 'publishedAt')

// Drop cached client in dev when Prisma schema was regenerated (enums / new columns / models).
if (
	process.env.NODE_ENV !== 'production' &&
	globalForPrisma.prisma &&
	(!AiReportType?.TIMETABLE || !hasPublishedAtField)
) {
	globalForPrisma.prisma.$disconnect().catch(() => {})
	globalForPrisma.prisma = null
}

const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma
}

module.exports = prisma
