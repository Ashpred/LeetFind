/**
 * auth.js — Auth Routes with input validation
 */

const express      = require('express')
const rateLimit    = require('express-rate-limit')
const { body }     = require('express-validator')
const router       = express.Router()
const authMiddleware = require('../middleware/authMiddleware')

const {
    register,
    login,
    logout,
    refresh,
    verify,
    me
} = require('../controllers/authController')

// ── Rate limiters ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max:      10,                // 10 attempts per window
    message:  { success: false, message: 'Too many attempts, try again in 15 minutes' }
})

const refreshLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 minute
    max:      5,
    message:  { success: false, message: 'Too many refresh attempts' }
})

// ── Validators ─────────────────────────────────────────────────────────────
const registerValidator = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username: letters, numbers, underscores only'),
    body('email')
        .trim()
        .isEmail()
        .withMessage('Valid email required')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain uppercase, lowercase and a number'),
]

const loginValidator = [
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
]

// ── Routes ─────────────────────────────────────────────────────────────────
router.post('/register', authLimiter,   registerValidator, register)
router.post('/login',    authLimiter,   loginValidator,    login)
router.post('/logout',                                     logout)
router.post('/refresh',  refreshLimiter,                   refresh)
router.get ('/verify',                                     verify)   // called by gateway
router.get ('/me',       authMiddleware,                   me)       // protected

module.exports = router
