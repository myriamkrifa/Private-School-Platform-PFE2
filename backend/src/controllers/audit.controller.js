const prisma = require('../prisma')

exports.listAuditLogs = async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10)
    const take = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 100

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    })

    return res.json({ success: true, data: logs })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching audit logs.', error: error.message })
  }
}

exports.createAuditLog = async ({ actorId, action, entityType, entityId, before, after, metadata }) => {
  try {
    if (!action || !entityType) return null

    return await prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        before: before ?? undefined,
        after: after ?? undefined,
        metadata: metadata ?? undefined
      }
    })
  } catch (_error) {
    return null
  }
}
