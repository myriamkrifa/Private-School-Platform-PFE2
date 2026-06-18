const bcrypt    = require('bcryptjs')
const jwt       = require('jsonwebtoken')
const prisma    = require('../prisma')
const admin     = require('../config/firebase')

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

    const normalizedEmail = String(email).trim().toLowerCase()

    // 2. Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' })
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // 4. Create user (inactive until admin approval) and matching role profile when needed
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: String(name).trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role,
          isActive: false
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
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

    return res.status(201).json({
      message: 'Registration submitted. An administrator must approve your account before you can sign in.',
      pendingApproval: true,
      user
    })

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
    const normalizedEmail = String(email).trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account is pending administrator approval. You will receive an email once approved.'
      })
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
// POST /api/auth/firebase-google
// ─────────────────────────────────────────────
const logFirebaseAuthError = (context, error) => {
  console.error(`[Firebase Google login] ${context}:`, {
    name: error?.name,
    code: error?.code,
    message: error?.message,
    errorInfo: error?.errorInfo
  })
  if (error?.stack) {
    console.error(error.stack)
  }
}

const firebaseGoogleLogin = async (req, res) => {
  try {
    const { idToken } = req.body

    if (!idToken) {
      console.warn('[Firebase Google login] Missing idToken in request body.')
      return res.status(400).json({ message: 'Firebase idToken is required.' })
    }

    if (!admin.apps.length) {
      console.error('[Firebase Google login] Admin SDK is not initialized. Check service account file and server boot logs.')
      return res.status(503).json({
        message: 'Google SSO is not configured on the server. Contact administrator.'
      })
    }

    let decodedToken
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken)
    } catch (verifyError) {
      logFirebaseAuthError('ID token verification failed', verifyError)
      return res.status(401).json({ message: 'Google authentication failed. Invalid or expired token.' })
    }

    const email = decodedToken?.email
    const firebaseUid = decodedToken?.uid

    if (!email || !firebaseUid) {
      console.error('[Firebase Google login] Token verified but missing email or uid:', {
        uid: firebaseUid,
        email: email ?? null
      })
      return res.status(401).json({ message: 'Invalid Google identity token.' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    console.log(`[Firebase Google login] Token verified for ${normalizedEmail} (uid: ${firebaseUid})`)

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    if (!user) {
      console.warn(`[Firebase Google login] No authorized user for email: ${normalizedEmail}`)
      return res.status(403).json({ message: 'User account not authorized by school administrator.' })
    }

    if (!user.isActive) {
      console.warn(`[Firebase Google login] Inactive user attempted sign-in: ${normalizedEmail}`)
      return res.status(403).json({ message: 'This account has been deactivated. Contact your administrator.' })
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { firebaseUid },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        identityCardNumber: true,
        phoneNumber: true,
        isFirstLogin: true,
        firebaseUid: true,
        createdAt: true,
        updatedAt: true
      }
    })

    const token = generateToken(updatedUser)
    console.log(`[Firebase Google login] Success for ${normalizedEmail} (role: ${updatedUser.role})`)
    return res.status(200).json({ user: updatedUser, token })
  } catch (error) {
    logFirebaseAuthError('Unexpected error', error)
    if (isPrismaInitError(error)) {
      return res.status(503).json({
        message: 'Database connection failed. Check DATABASE_URL credentials and restart backend.'
      })
    }
    return res.status(500).json({ message: 'Google authentication failed. Please try again.' })
  }
}

// ─────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isFirstLogin: true,
        createdAt: true
      }
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
      select: { id: true, role: true, isFirstLogin: true }
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (user.role !== 'PARENT') {
      return res.status(403).json({ message: 'Only parents can use this endpoint.' })
    }

    if (!user.isFirstLogin) {
      return res.status(400).json({ message: 'Password has already been changed.' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, isFirstLogin: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        identityCardNumber: true,
        phoneNumber: true,
        isFirstLogin: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return res.status(200).json({
      message: 'Password changed successfully.',
      user: updatedUser
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

module.exports = { register, login, firebaseGoogleLogin, getMe, logout, changePasswordFirstLogin }
