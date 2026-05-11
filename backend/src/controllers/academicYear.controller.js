const prisma = require('../prisma')

exports.getAcademicYears = async (_req, res) => {
  try {
    const years = await prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } })
    return res.json({ success: true, data: years })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching academic years.', error: error.message })
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
      await prisma.academicYear.updateMany({ data: { isActive: false } })
    }

    const created = await prisma.academicYear.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: Boolean(isActive)
      }
    })

    return res.status(201).json({ success: true, data: created, message: 'Academic year created.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error creating academic year.', error: error.message })
  }
}

exports.updateAcademicYear = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    const { name, startDate, endDate, isActive } = req.body

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid academic year id.' })
    }

    if (isActive) {
      await prisma.academicYear.updateMany({
        where: { NOT: { id } },
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

exports.deleteAcademicYear = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    await prisma.academicYear.delete({ where: { id } })
    return res.json({ success: true, message: 'Academic year deleted.' })
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting academic year.', error: error.message })
  }
}
