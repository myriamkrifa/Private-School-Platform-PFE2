export const PRIMARY_GRADES = [
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'Primary 6'
]

export const SECONDARY_GRADES = ['Secondary 1', 'Secondary 2', 'Secondary 3']

export const EDUCATION_LEVELS = [
  { value: 'Primary', label: 'Primary' },
  { value: 'Secondary', label: 'Secondary' }
]

export function gradesForEducationLevel(educationLevel) {
  if (educationLevel === 'Primary') return PRIMARY_GRADES
  if (educationLevel === 'Secondary') return SECONDARY_GRADES
  return []
}

export function educationLevelFromClass(klass) {
  if (!klass) return ''
  if (klass.level === 'PRIMARY') return 'Primary'
  if (klass.level === 'SECONDARY') return 'Secondary'
  return ''
}
