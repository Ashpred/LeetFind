/**
 * authMiddleware.js — Protect routes within auth service
 */

const { verifyToken } = require('../utils/jwt')

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

        const decoded = verifyToken(token)
        req.user      = decoded
        next()

    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        })
    }
}

module.exports = authMiddleware
