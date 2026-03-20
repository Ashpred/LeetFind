/**
 * authMiddleware.js — Gateway JWT verification
 * Verifies token locally (fast) then attaches user to request
 * Forwards user info to downstream services via headers
 */

const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
    try {
        // Check cookie first, then Authorization header
        const token =
            req.cookies?.accessToken ||
            req.headers['authorization']?.split(' ')[1]

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            })
        }

        // Verify token locally — faster than calling auth service every request
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Attach user to request
        req.user = decoded

        // Forward user info to downstream services via headers
        // Services trust these headers since they come from the gateway
        req.headers['x-user-id']       = decoded.id
        req.headers['x-user-email']    = decoded.email
        req.headers['x-user-username'] = decoded.username

        next()

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired',
                code:    'TOKEN_EXPIRED'    // React can use this to trigger refresh
            })
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        })
    }
}

module.exports = authMiddleware
