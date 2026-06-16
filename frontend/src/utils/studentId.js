const CODE_LENGTH = 11
const DIGITS = '0123456789'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghjkmnpqrstuvwxyz'
const ID_SLOTS = [9, 1, 2, 4, 7]
const SIMPLE_STU_PATTERN = /^STU-(\d+)$/i
const LEGACY_YEAR_PATTERN = /^STU-(\d{4})-(\d+)$/i
const ALPHANUMERIC_CODE_PATTERN = /^[0-9A-Za-z]{11}$/

function buildLegacyStudentCode(id) {
  const padded = String(id).padStart(5, '0')
  const code = new Array(CODE_LENGTH)

  ID_SLOTS.forEach((slot, index) => {
    code[slot] = padded[index]
  })

  const fillers = [
    () => DIGITS[(id * 3 + 1) % 10],
    null,
    null,
    () => UPPER[id % UPPER.length],
    null,
    () => DIGITS[(id * 7 + 3) % 10],
    () => DIGITS[(id * 11 + 2) % 10],
    null,
    () => LOWER[(id * 13 + 5) % LOWER.length],
    null,
    () => LOWER[(id * 17 + 9) % LOWER.length]
  ]

  fillers.forEach((fill, index) => {
    if (code[index]) return
    code[index] = fill ? fill() : DIGITS[(id + index) % 10]
  })

  return code.join('')
}

function decodeLegacyStudentCode(code) {
  if (!ALPHANUMERIC_CODE_PATTERN.test(code)) return null

  const digits = ID_SLOTS.map((slot) => code[slot]).join('')
  const id = Number.parseInt(digits, 10)
  if (!Number.isInteger(id) || id <= 0) return null
  if (buildLegacyStudentCode(id) !== code) return null
  return id
}

export function formatStudentId(studentId) {
  const id = Number(studentId)
  if (!Number.isInteger(id) || id <= 0) return ''
  return `STU-${String(id).padStart(3, '0')}`
}

export function parseStudentIdInput(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const simpleStu = raw.match(SIMPLE_STU_PATTERN)
  if (simpleStu) {
    const id = Number.parseInt(simpleStu[1], 10)
    return Number.isInteger(id) && id > 0 ? id : null
  }

  const legacyYear = raw.match(LEGACY_YEAR_PATTERN)
  if (legacyYear) {
    const id = Number.parseInt(legacyYear[2], 10)
    return Number.isInteger(id) && id > 0 ? id : null
  }

  const decoded = decodeLegacyStudentCode(raw)
  if (decoded) return decoded

  if (/^\d{1,9}$/.test(raw)) {
    const id = Number.parseInt(raw, 10)
    return Number.isInteger(id) && id > 0 ? id : null
  }

  return null
}
