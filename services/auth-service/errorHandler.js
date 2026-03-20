/**
 * errorHandler.js — Global error handler
 */

const errorHandler = (err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] ${err.stack}`)

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => ({
            field:   e.path,
            message: e.message
        }))
        return res.status(400).json({ success: false, errors })
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0]
        return res.status(409).json({
            success: false,
            message: `${field} already exists`
        })
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token' })
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired' })
    }

    // Default 500
    return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    })
}

module.exports = errorHandler
