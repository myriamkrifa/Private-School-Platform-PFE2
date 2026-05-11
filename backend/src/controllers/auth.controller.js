const bcrypt    = require('bcryptjs')
const jwt       = require('jsonwebtoken')
const prisma    = require('../prisma')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me'
const ALLOWED_ROLES = ['ADMIN', 'STUDENT', 'TEACHER', 'PARENT']

const isPrismaInitError = (error) => {
  return error?.name === 'PrismaClientInitializationError' || ['P1000', 'P1001'].includes(error?.code)
}

// Helper to generate a JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    // 1. Validate fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' })
    }

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Please select a valid role: ADMIN, STUDENT, TEACHER, or PARENT.' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' })
    }

    // 2. Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' })
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // 4. Create user and matching role profile when needed
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { name, email, password: hashedPassword, role },
        select: { id: true, name: true, email: true, role: true, createdAt: true }
      })

      if (role === 'STUDENT') {
        await tx.student.create({
          data: {
            userId: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            grade: 'N/A'
          }
        })
      }

      if (role === 'TEACHER') {
        await tx.teacher.create({
          data: {
            userId: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            subject: 'General'
          }
        })
      }

      return createdUser
    })

    // 5. Generate token and respond
    const token = generateToken(user)
    return res.status(201).json({ user, token })

  } catch (error) {
    console.error('Register error:', error)
    if (isPrismaInitError(error)) {
      return res.status(503).json({
        message: 'Database connection failed. Check DATABASE_URL credentials and restart backend.'
      })
    }
    return res.status(500).json({ message: 'Server error. Please try again.' })
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // 1. Validate
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }

    // 2. Find user
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    // 4. Return token (never return the password)
    const { password: _, ...userWithoutPassword } = user
    const token = generateToken(userWithoutPassword)
    return res.status(200).json({ user: userWithoutPassword, token })

  } catch (error) {
    console.error('Login error:', error)
    if (isPrismaInitError(error)) {
      return res.status(503).json({
        message: 'Database connection failed. Check DATABASE_URL credentials and restart backend.'
      })
    }
    return res.status(500).json({ message: 'Server error. Please try again.' })
  }
}

// ─────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    })
    if (!user) return res.status(404).json({ message: 'User not found.' })
    return res.status(200).json({ user })
  } catch (error) {
    console.error('GetMe error:', error)
    if (isPrismaInitError(error)) {
      return res.status(503).json({
        message: 'Database connection failed. Check DATABASE_URL credentials and restart backend.'
      })
    }
    return res.status(500).json({ message: 'Server error.' })
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/logout (protected)
// ─────────────────────────────────────────────
const logout = async (_req, res) => {
  return res.status(200).json({
    message: 'Logged out successfully. Remove token on client side.'
  })
}

// ─────────────────────────────────────────────
// POST /api/auth/change-password-first-login (protected)
// ─────────────────────────────────────────────
const changePasswordFirstLogin = async (req, res) => {
  try {
    const { newPassword } = req.body

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, role: true }
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (user.role !== 'PARENT') {
      return res.status(403).json({ message: 'Only parents can use this endpoint.' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    return res.status(200).json({
      message: 'Password changed successfully.'
    })
  } catch (error) {
    console.error('Change password first login error:', error)
    if (isPrismaInitError(error)) {
      return res.status(503).json({
        message: 'Database connection failed. Check DATABASE_URL credentials and restart backend.'
      })
    }
    return res.status(500).json({ message: 'Server error. Please try again.' })
  }
}

module.exports = { register, login, getMe, logout, changePasswordFirstLogin }
