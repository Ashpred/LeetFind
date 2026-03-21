/**
 * index.js — Solves Service Entry Point
 * Port: 4003
 */

require('dotenv').config({
    path: require('path').join(__dirname, '..', '.env')
})

const express      = require('express')
const cors         = require('cors')
const morgan       = require('morgan')
const mongoose     = require('mongoose')
const solveRoutes  = require('./routes/solves')

const app  = express()
const PORT = process.env.PORT || 4003

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.use('/solves', solveRoutes)

app.get('/health', (req, res) => {
    res.json({
        status:   'ok',
        service:  'solves-service',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime:   process.uptime()
    })
})

app.use((err, req, res, next) => {
    console.error(`[Solves Service Error] ${err.message}`)
    res.status(err.status || 500).json({ success: false, message: err.message })
})

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB connected')
        app.listen(PORT, () => console.log(`🚀 Solves Service running on port ${PORT}`))
    })
    .catch(err => { console.error('❌ MongoDB:', err.message); process.exit(1) })
