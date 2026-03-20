/**
 * index.js — Auth Service Entry Point
 * Port: 4001
 */

require('dotenv').config()
const express      = require('express')
const cors         = require('cors')
const cookieParser = require('cookie-parser')
const morgan       = require('morgan')
const mongoose     = require('mongoose')
const authRoutes   = require('./routes/auth')
const errorHandler = require('./middleware/errorHandler')

const app  = express()
const PORT = process.env.PORT || 4001

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.GATEWAY_URL, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes)

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status:  'ok',
        service: 'auth-service',
        uptime:  process.uptime()
    })
})

// ── Error handler ──────────────────────────────────────────────────────────
app.use(errorHandler)

// ── DB + Start ─────────────────────────────────────────────────────────────
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB connected')
        app.listen(PORT, () => {
            console.log(`🚀 Auth Service running on port ${PORT}`)
        })
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message)
        process.exit(1)
    })
