/**
 * index.js — Problems Service Entry Point
 * Port: 4002
 */

require('dotenv').config({
    path: require('path').join(__dirname, '..', '.env')
})

const express       = require('express')
const cors          = require('cors')
const morgan        = require('morgan')
const mongoose      = require('mongoose')
const problemRoutes = require('./routes/problems')

const app  = express()
const PORT = process.env.PORT || 4002

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/problems', problemRoutes)

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    res.json({
        status:   'ok',
        service:  'problems-service',
        database: dbState,
        uptime:   process.uptime()
    })
})

// ── Error handler ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(`[Problems Service Error] ${err.message}`)
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    })
})

// ── DB + Start ─────────────────────────────────────────────────────────────
mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB connected')
        app.listen(PORT, () => {
            console.log(`🚀 Problems Service running on port ${PORT}`)
        })
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message)
        process.exit(1)
    })
