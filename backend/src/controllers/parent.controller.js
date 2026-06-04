const prisma = require('../prisma')

const normalizeIdentityCardNumber = (value) => {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

exports.getAllParents = async (req, res) => {
  try {
    const parents = await prisma.user.findMany({
      where: { role: 'PARENT' },
      select: {
        id: true,
        name: true,
        email: true,
        identityCardNumber: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        _count: { select: { parentLinks: true } }
      },
      orderBy: { name: 'asc' }
    })

    const data = parents.map((parent) => ({
      id: parent.id,
      name: parent.name,
      email: parent.email,
      identityCardNumber: parent.identityCardNumber,
      phoneNumber: parent.phoneNumber,
      isActive: parent.isActive,
      createdAt: parent.createdAt,
      childrenCount: parent._count.parentLinks
    }))

    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching parents.', error: error.message })
  }
}

exports.getParentById = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid parent id.' })
    }

    const parent = await prisma.user.findFirst({
      where: { id, role: 'PARENT' },
      select: {
        id: true,
        name: true,
        email: true,
        identityCardNumber: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        parentLinks: {
          include: {
            student: { select: { id: true, name: true, email: true, grade: true } }
          }
        }
      }
    })

    if (!parent) {
      return res.status(404).json({ message: 'Parent not found.' })
    }

    res.json({ success: true, data: parent })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching parent.', error: error.message })
  }
}

exports.updateParent = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid parent id.' })
    }

    const existing = await prisma.user.findFirst({
      where: { id, role: 'PARENT' }
    })
    if (!existing) {
      return res.status(404).json({ message: 'Parent not found.' })
    }

    const { name, email, identityCardNumber, phoneNumber, isActive } = req.body
    const data = {}

    if (name !== undefined) {
      const trimmed = String(name).trim()
      if (!trimmed) return res.status(400).json({ message: 'Name is required.' })
      data.name = trimmed
    }
    if (email !== undefined) {
      const trimmed = String(email).trim().toLowerCase()
      if (!trimmed) return res.status(400).json({ message: 'Email is required.' })
      data.email = trimmed
    }
    if (identityCardNumber !== undefined) {
      const normalized = normalizeIdentityCardNumber(identityCardNumber)
      if (!normalized) return res.status(400).json({ message: 'Identity card number is required.' })
      data.identityCardNumber = normalized
    }
    if (phoneNumber !== undefined) {
      const trimmed = String(phoneNumber).trim()
      if (!trimmed) return res.status(400).json({ message: 'Phone number is required.' })
      data.phoneNumber = trimmed
    }
    if (isActive !== undefined) {
      data.isActive = Boolean(isActive)
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No fields to update.' })
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        identityCardNumber: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        _count: { select: { parentLinks: true } }
      }
    })

    const { _count, ...parent } = updated

    res.json({
      success: true,
      data: {
        ...parent,
        childrenCount: _count.parentLinks
      },
      message: 'Parent updated.'
    })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Email or identity card number already in use.' })
    }
    res.status(500).json({ message: 'Error updating parent.', error: error.message })
  }
}

exports.deleteParent = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid parent id.' })
    }

    const existing = await prisma.user.findFirst({
      where: { id, role: 'PARENT' }
    })
    if (!existing) {
      return res.status(404).json({ message: 'Parent not found.' })
    }

    await prisma.user.delete({ where: { id } })
    res.json({ success: true, message: 'Parent deleted.' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting parent.', error: error.message })
  }
}
