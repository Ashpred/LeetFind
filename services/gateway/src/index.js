/**
 * index.js — API Gateway Entry Point
 * Port: 3000
 * Single entry point for all microservices
 */

require('dotenv').config({ 
    path: require('path').join(__dirname, '..', '.env') 
})
console.log('ENV CHECK:', {
    AUTH: process.env.AUTH_SERVICE_URL,
    JWT:  process.env.JWT_SECRET ? 'SET' : 'MISSING'
})
const express      = require('express')
const cors         = require('cors')
const cookieParser = require('cookie-parser')
const morgan       = require('morgan')
const rateLimit    = require('express-rate-limit')

const authMiddleware     = require('./middleware/authMiddleware')
const { createProxies }  = require('./routes/proxy')
const errorHandler       = require('./middleware/errorHandler')
const serviceHealth      = require('./middleware/serviceHealth')

const app  = express()
const PORT = process.env.PORT || 3000

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
    origin:      process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,    // allow cookies
    methods:     ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

// ── Core middleware ────────────────────────────────────────────────────────

app.use(cookieParser())
app.use(morgan('dev'))

// ── Global rate limiter ────────────────────────────────────────────────────
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max:      500,               // 500 requests per window per IP
    message:  { success: false, message: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders:   false
}))

app.use(express.json())

// ── Gateway health ─────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    const health = await serviceHealth.checkAll()
    const allUp  = Object.values(health).every(s => s === 'up')
    res.status(allUp ? 200 : 207).json({
        status:   allUp ? 'ok' : 'degraded',
        gateway:  'up',
        services: health
    })
})

// ── Public routes (no auth required) ──────────────────────────────────────
// Auth routes pass through directly — auth service handles its own validation
app.use('/api/auth', createProxies().auth)

// ── Protected routes (auth required) ──────────────────────────────────────
app.use('/api/problems',        authMiddleware, createProxies().problems)
app.use('/api/solves',          authMiddleware, createProxies().solves)
app.use('/api/recommendations', authMiddleware, createProxies().recommendations)
app.use('/api/users',           authMiddleware, createProxies().users)



// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`
    })
})

// ── Error handler ──────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 API Gateway running on port ${PORT}`)
    console.log(`   Auth Service    → ${process.env.AUTH_SERVICE_URL}`)
    console.log(`   Problems Service→ ${process.env.PROBLEMS_SERVICE_URL}`)
    console.log(`   Solves Service  → ${process.env.SOLVES_SERVICE_URL}`)
    console.log(`   Recs Service    → ${process.env.RECS_SERVICE_URL}`)
    console.log(`   User Service    → ${process.env.USER_SERVICE_URL}`)
})
