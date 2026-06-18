const prisma = require('../prisma')
const { buildYearDetailsPayload, yearDetailsInclude } = require('../services/academicYearDetails.service')

const parseId = (raw) => {
  const id = Number.parseInt(raw, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

exports.getAcademicYears = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true'
    const archivedOnly = req.query.archived === 'true'

    const where = archivedOnly
      ? { isArchived: true }
      : includeArchived
        ? {}
        : { isArchived: false }

    const years = await prisma.academicYear.findMany({
      where,
      orderBy: { startDate: 'desc' }
    })
    return res.json({ success: true, data: years })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching academic years.', error: error.message })
  }
}

exports.getAcademicYearById = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) {
      return res.status(400).json({ message: 'Invalid academic year id.' })
    }

    const year = await prisma.academicYear.findUnique({
      where: { id },
      include: yearDetailsInclude
    })

    if (!year) {
      return res.status(404).json({ message: 'Academic year not found.' })
    }

    return res.json({ success: true, data: buildYearDetailsPayload(year) })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching academic year.', error: error.message })
  }
}

exports.createAcademicYear = async (req, res) => {
  try {
    const { name, startDate, endDate, isActive } = req.body
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ message: 'Please provide name, startDate, and endDate.' })
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'startDate must be before endDate.' })
    }

    if (isActive) {
      await prisma.academicYear.updateMany({
        where: { isArchived: false },
        data: { isActive: false }
      })
    }

    const created = await prisma.academicYear.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: Boolean(isActive),
        isArchived: false
      }
    })

    return res.status(201).json({ success: true, data: created, message: 'Academic year created.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error creating academic year.', error: error.message })
  }
}

exports.updateAcademicYear = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    const { name, startDate, endDate, isActive } = req.body

    if (!id) {
      return res.status(400).json({ message: 'Invalid academic year id.' })
    }

    const existing = await prisma.academicYear.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ message: 'Academic year not found.' })
    }
    if (existing.isArchived) {
      return res.status(403).json({ message: 'Archived academic years cannot be edited.' })
    }

    if (isActive) {
      await prisma.academicYear.updateMany({
        where: { NOT: { id }, isArchived: false },
        data: { isActive: false }
      })
    }

    const updated = await prisma.academicYear.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {})
      }
    })

    return res.json({ success: true, data: updated, message: 'Academic year updated.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error updating academic year.', error: error.message })
  }
}

exports.archiveAcademicYear = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) {
      return res.status(400).json({ message: 'Invalid academic year id.' })
    }

    const existing = await prisma.academicYear.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ message: 'Academic year not found.' })
    }
    if (existing.isArchived) {
      return res.status(400).json({ message: 'Academic year is already archived.' })
    }

    const archived = await prisma.academicYear.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        isActive: false
      }
    })

    return res.json({
      success: true,
      data: archived,
      message: 'Academic year archived. All related records are preserved for historical reference.'
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error archiving academic year.', error: error.message })
  }
}

exports.restoreAcademicYear = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) {
      return res.status(400).json({ message: 'Invalid academic year id.' })
    }

    const existing = await prisma.academicYear.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ message: 'Academic year not found.' })
    }
    if (!existing.isArchived) {
      return res.status(400).json({ message: 'Academic year is not archived.' })
    }

    const restored = await prisma.academicYear.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        isActive: false
      }
    })

    return res.json({
      success: true,
      data: restored,
      message: 'Academic year restored to the active list.'
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error restoring academic year.', error: error.message })
  }
}

exports.deleteAcademicYear = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) {
      return res.status(400).json({ message: 'Invalid academic year id.' })
    }

    const existing = await prisma.academicYear.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ message: 'Academic year not found.' })
    }
    if (existing.isArchived) {
      return res.status(403).json({
        message: 'Archived academic years cannot be deleted. Restore the year first or keep it as a historical record.'
      })
    }

    await prisma.academicYear.delete({ where: { id } })
    return res.json({ success: true, message: 'Academic year deleted.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting academic year.', error: error.message })
  }
}
