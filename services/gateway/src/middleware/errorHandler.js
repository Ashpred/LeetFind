/**
 * errorHandler.js — Gateway global error handler
 */

const errorHandler = (err, req, res, next) => {
    console.error(`[Gateway Error] ${err.message}`)

    // Proxy errors
    if (err.code === 'ECONNREFUSED') {
        return res.status(502).json({
            success: false,
            message: 'Downstream service unavailable'
        })
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Gateway error'
    })
}

module.exports = errorHandler
