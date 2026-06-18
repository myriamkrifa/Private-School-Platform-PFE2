const express  = require('express')
const router   = express.Router()
const {
  register,
  login,
  firebaseGoogleLogin,
  getMe,
  logout,
  changePasswordFirstLogin
} = require('../controllers/auth.controller')
const { protect, authorize } = require('../middlewares/auth.middleware')

// Admin-only account provisioning
router.post('/register', protect, authorize('ADMIN'), register)
router.post('/login',    login)
router.post('/firebase-google', firebaseGoogleLogin)

// Protected route
router.get('/me', protect, getMe)
router.post('/logout', protect, logout)
router.post('/change-password-first-login', protect, changePasswordFirstLogin)

module.exports = router
