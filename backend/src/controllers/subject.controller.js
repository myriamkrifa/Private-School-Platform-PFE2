const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')

const CLASS_LEVELS = ['PRIMARY', 'SECONDARY']

const sanitizeLevelTag = (value) => {
  if (!value) return null
  return CLASS_LEVELS.includes(value) ? value : null
}

const buildSubjectData = (body) => {
  const { title, name, code, description, coefficient, levelTag, level } = body
  const data = {}
  const finalTitle = title || name
  if (finalTitle !== undefined) data.title = String(finalTitle).trim()
  if (code !== undefined) data.code = code ? String(code).trim().toUpperCase() : null
  if (description !== undefined) data.description = description || null
  if (coefficient !== undefined) {
    const coef = Number(coefficient)
    if (!Number.isFinite(coef) || coef <= 0) {
      throw new Error('coefficient must be a positive number.')
    }
    data.coefficient = coef
  }
  const inputLevel = levelTag !== undefined ? levelTag : level
  if (inputLevel !== undefined) data.levelTag = sanitizeLevelTag(inputLevel)
  return data
}

exports.listSubjects = async (_req, res) => {
  try {
    const subjects = await prisma.course.findMany({
      include: {
        teachingAssignments: {
          select: {
            id: true,
            class: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true } }
          }
        },
        _count: { select: { grades: true, assignments: true, teachingAssignments: true } }
      },
      orderBy: { title: 'asc' }
    })
    return res.json({ success: true, data: subjects })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching subjects.', error: error.message })
  }
}

exports.getSubjectById = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const subject = await prisma.course.findUnique({
      where: { id },
      include: {
        teachingAssignments: {
          include: {
            class: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true } }
          }
        },
        materials: { orderBy: { createdAt: 'desc' } }
      }
    })
    if (!subject) return res.status(404).json({ message: 'Subject not found.' })
    return res.json({ success: true, data: subject })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching subject.', error: error.message })
  }
}

exports.createSubject = async (req, res) => {
  try {
    const data = buildSubjectData(req.body)
    if (!data.title) {
      return res.status(400).json({ message: 'Please provide a subject title.' })
    }
    if (data.coefficient === undefined) data.coefficient = 1

    const created = await prisma.course.create({ data })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'SUBJECT_CREATE',
      entityType: 'Course',
      entityId: created.id,
      after: created
    })
    return res.status(201).json({ success: true, data: created, message: 'Subject created.' })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error creating subject.' })
  }
}

exports.updateSubject = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const data = buildSubjectData(req.body)

    const existing = await prisma.course.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ message: 'Subject not found.' })

    const updated = await prisma.course.update({ where: { id }, data })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'SUBJECT_UPDATE',
      entityType: 'Course',
      entityId: updated.id,
      before: existing,
      after: updated
    })
    return res.json({ success: true, data: updated, message: 'Subject updated.' })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error updating subject.' })
  }
}

exports.deleteSubject = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const counts = await prisma.course.findUnique({
      where: { id },
      select: {
        _count: {
          select: { grades: true, attendances: true, assignments: true, teachingAssignments: true }
        }
      }
    })
    if (!counts) return res.status(404).json({ message: 'Subject not found.' })

    const linked = (counts._count.grades || 0)
      + (counts._count.attendances || 0)
      + (counts._count.assignments || 0)
      + (counts._count.teachingAssignments || 0)

    if (linked > 0) {
      return res.status(400).json({
        message: 'Cannot delete subject while grades, attendances, assignments, or teaching assignments reference it.'
      })
    }

    await prisma.course.delete({ where: { id } })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'SUBJECT_DELETE',
      entityType: 'Course',
      entityId: id
    })
    return res.json({ success: true, message: 'Subject deleted.' })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error deleting subject.' })
  }
}
