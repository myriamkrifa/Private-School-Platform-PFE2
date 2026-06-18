const PRIMARY_GRADES = ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6']
const SECONDARY_GRADES = ['Secondary 1', 'Secondary 2', 'Secondary 3']

const normalizeEducationLevel = (value) => {
  const raw = String(value || '').trim()
  if (raw === 'PRIMARY' || raw.toLowerCase() === 'primary') return 'PRIMARY'
  if (raw === 'SECONDARY' || raw.toLowerCase() === 'secondary') return 'SECONDARY'
  return null
}

const isValidGradeForLevel = (level, grade) => {
  const options = level === 'PRIMARY' ? PRIMARY_GRADES : SECONDARY_GRADES
  return options.includes(String(grade || '').trim())
}

const findOrCreateClassByGrade = async (tx, { educationLevel, grade }) => {
  const level = normalizeEducationLevel(educationLevel)
  if (!level) {
    throw new Error('Education level must be Primary or Secondary.')
  }

  const trimmedGrade = String(grade || '').trim()
  if (!isValidGradeForLevel(level, trimmedGrade)) {
    throw new Error(`Invalid grade "${trimmedGrade}" for education level ${level}.`)
  }

  const existing = await tx.class.findFirst({
    where: { grade: trimmedGrade, level }
  })
  if (existing) return existing

  const activeYear = await tx.academicYear.findFirst({
    where: { isActive: true, isArchived: false },
    select: { id: true }
  })

  return tx.class.create({
    data: {
      name: trimmedGrade,
      room: 'TBD',
      level,
      grade: trimmedGrade,
      academicYearId: activeYear?.id ?? null
    }
  })
}

module.exports = {
  PRIMARY_GRADES,
  SECONDARY_GRADES,
  normalizeEducationLevel,
  isValidGradeForLevel,
  findOrCreateClassByGrade
}
