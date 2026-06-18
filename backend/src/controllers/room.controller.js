const prisma = require('../prisma')
const { createAuditLog } = require('./audit.controller')
const {
  prepareAssignmentsWithAutoRooms,
  createSchedulingPlan,
  formatMasterScheduleByTimeHtml,
  formatRoomTimetableGridHtml
} = require('../services/aiTimetable.service')

const parseId = (raw) => {
  const id = Number.parseInt(raw, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

exports.getAllRooms = async (_req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { name: 'asc' }
    })
    return res.json({ success: true, data: rooms })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching rooms.', error: error.message })
  }
}

exports.createRoom = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    if (!name) {
      return res.status(400).json({ message: 'Room name is required.' })
    }

    const data = { name }
    if (req.body?.building !== undefined) {
      data.building = req.body.building ? String(req.body.building).trim() : null
    }
    if (req.body?.capacity !== undefined && req.body?.capacity !== null && req.body?.capacity !== '') {
      const capacity = Number.parseInt(req.body.capacity, 10)
      if (!Number.isInteger(capacity) || capacity < 1) {
        return res.status(400).json({ message: 'Capacity must be a positive integer.' })
      }
      data.capacity = capacity
    }

    const room = await prisma.room.create({ data })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'ROOM_CREATE',
      entityType: 'Room',
      entityId: room.id,
      after: room
    })
    return res.status(201).json({ success: true, data: room, message: 'Room created.' })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'A room with this name already exists.' })
    }
    return res.status(400).json({ message: error.message || 'Error creating room.' })
  }
}

exports.updateRoom = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ message: 'Invalid room id.' })

    const data = {}
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim()
      if (!name) return res.status(400).json({ message: 'Room name cannot be empty.' })
      data.name = name
    }
    if (req.body?.building !== undefined) {
      data.building = req.body.building ? String(req.body.building).trim() : null
    }
    if (req.body?.capacity !== undefined) {
      if (req.body.capacity === null || req.body.capacity === '') {
        data.capacity = null
      } else {
        const capacity = Number.parseInt(req.body.capacity, 10)
        if (!Number.isInteger(capacity) || capacity < 1) {
          return res.status(400).json({ message: 'Capacity must be a positive integer.' })
        }
        data.capacity = capacity
      }
    }

    const room = await prisma.room.update({ where: { id }, data })

    await createAuditLog({
      actorId: req.user?.id,
      action: 'ROOM_UPDATE',
      entityType: 'Room',
      entityId: room.id,
      after: room
    })
    return res.json({ success: true, data: room, message: 'Room updated.' })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'A room with this name already exists.' })
    }
    return res.status(400).json({ message: error.message || 'Error updating room.' })
  }
}

exports.deleteRoom = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ message: 'Invalid room id.' })

    await prisma.room.delete({ where: { id } })
    await createAuditLog({
      actorId: req.user?.id,
      action: 'ROOM_DELETE',
      entityType: 'Room',
      entityId: id
    })
    return res.json({ success: true, message: 'Room deleted.' })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error deleting room.' })
  }
}

exports.generateRoomTimetable = async (req, res) => {
  try {
    const roomId = parseId(req.params.id)
    if (!roomId) return res.status(400).json({ message: 'Invalid room id.' })

    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) return res.status(404).json({ message: 'Room not found.' })

    const { assignments, rooms } = await prepareAssignmentsWithAutoRooms()
    if (!rooms.length) {
      return res.status(400).json({ message: 'Create at least one room first.' })
    }

    const scheduling = createSchedulingPlan(assignments, rooms)
    const content = formatRoomTimetableGridHtml(assignments, room.name, scheduling)

    return res.json({
      success: true,
      data: { roomId: room.id, roomName: room.name, content }
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error generating room timetable.', error: error.message })
  }
}

exports.generateMasterSchedule = async (_req, res) => {
  try {
    const { assignments, rooms } = await prepareAssignmentsWithAutoRooms()
    if (!rooms.length) {
      return res.status(400).json({ message: 'Create at least one room first.' })
    }
    if (!assignments.length) {
      return res.status(400).json({
        message: 'No teaching assignments found. Assign teachers to classes first.'
      })
    }

    const content = formatMasterScheduleByTimeHtml(assignments, rooms)
    return res.json({ success: true, data: { content } })
  } catch (error) {
    return res.status(500).json({ message: 'Error generating schedule.', error: error.message })
  }
}
