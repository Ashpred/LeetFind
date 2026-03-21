/**
 * index.js — User Service Entry Point
 * Port: 4005
 */

require('dotenv').config({
    path: require('path').join(__dirname, '..', '.env')
})

const express    = require('express')
const cors       = require('cors')
const morgan     = require('morgan')
const mongoose   = require('mongoose')
const userRoutes = require('./routes/users')

const app  = express()
const PORT = process.env.PORT || 4005

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.use('/users', userRoutes)

app.get('/health', (req, res) => {
    res.json({
        status:   'ok',
        service:  'user-service',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime:   process.uptime()
    })
})

app.use((err, req, res, next) => {
    console.error(`[User Service Error] ${err.message}`)
    res.status(err.status || 500).json({ success: false, message: err.message })
})

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB connected')
        app.listen(PORT, () => console.log(`🚀 User Service running on port ${PORT}`))
    })
    .catch(err => { console.error('❌ MongoDB:', err.message); process.exit(1) })
