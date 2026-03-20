/**
 * authController.js — Register, Login, Logout, Refresh, Verify
 */

const { validationResult } = require('express-validator')
const User = require('../models/User')
const {
    generateTokenPair,
    verifyToken,
    setTokenCookies,
    clearTokenCookies
} = require('../utils/jwt')

// ── Register ───────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
    try {
        // Validate inputs
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors:  errors.array().map(e => ({ field: e.path, message: e.msg }))
            })
        }

        const { username, email, password } = req.body

        // Check duplicates
        const existing = await User.findOne({
            $or: [{ email }, { username }]
        })
        if (existing) {
            const field = existing.email === email ? 'email' : 'username'
            return res.status(409).json({
                success: false,
                message: `${field} already in use`
            })
        }

        // Create user — passwordHash field triggers bcrypt pre-save hook
        const user = await User.create({
            username,
            email,
            passwordHash: password
        })

        // Generate tokens
        const { accessToken, refreshToken } = generateTokenPair(user)

        // Save refresh token to DB
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        // Set httpOnly cookies
        setTokenCookies(res, accessToken, refreshToken)

        // Also notify User Service to create profile (fire and forget)
        notifyUserService(user._id, username, email)

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            user:    user.toPublic(),
            // Also return token in body for non-browser clients (Postman, mobile)
            accessToken
        })

    } catch (err) {
        next(err)
    }
}

// ── Login ──────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors:  errors.array().map(e => ({ field: e.path, message: e.msg }))
            })
        }

        const { email, password } = req.body

        // Explicitly select passwordHash (excluded by default in schema)
        const user = await User.findOne({ email }).select('+passwordHash')
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            })
        }

        // Verify password
        const isMatch = await user.comparePassword(password)
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            })
        }

        // Generate new tokens on every login
        const { accessToken, refreshToken } = generateTokenPair(user)
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        setTokenCookies(res, accessToken, refreshToken)

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            user:    user.toPublic(),
            accessToken
        })

    } catch (err) {
        next(err)
    }
}

// ── Logout ─────────────────────────────────────────────────────────────────
const logout = async (req, res, next) => {
    try {
        const token = req.cookies?.refreshToken

        if (token) {
            // Invalidate refresh token in DB
            await User.findOneAndUpdate(
                { refreshToken: token },
                { refreshToken: null }
            )
        }

        clearTokenCookies(res)

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        })

    } catch (err) {
        next(err)
    }
}

// ── Refresh token ──────────────────────────────────────────────────────────
const refresh = async (req, res, next) => {
    try {
        const token = req.cookies?.refreshToken
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No refresh token'
            })
        }

        // Verify token signature
        const decoded = verifyToken(token)

        // Check token matches what we stored (rotation check)
        const user = await User.findOne({
            _id:          decoded.id,
            refreshToken: token
        }).select('+refreshToken')

        if (!user) {
            clearTokenCookies(res)
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            })
        }

        // Issue new token pair (rotation)
        const { accessToken, refreshToken: newRefresh } = generateTokenPair(user)
        user.refreshToken = newRefresh
        await user.save({ validateBeforeSave: false })

        setTokenCookies(res, accessToken, newRefresh)

        return res.status(200).json({
            success:     true,
            accessToken
        })

    } catch (err) {
        // JWT expired or invalid
        clearTokenCookies(res)
        return res.status(401).json({
            success: false,
            message: 'Refresh token expired — please log in again'
        })
    }
}

// ── Verify ─────────────────────────────────────────────────────────────────
// Called by API Gateway to validate incoming requests
const verify = async (req, res) => {
    try {
        // Token comes from Authorization header (sent by gateway)
        const authHeader = req.headers['authorization']
        const token      = authHeader?.split(' ')[1]

        if (!token) {
            return res.status(401).json({ valid: false, message: 'No token' })
        }

        const decoded = verifyToken(token)

        // Optionally check user still exists and is active
        const user = await User.findById(decoded.id).select('isActive')
        if (!user || !user.isActive) {
            return res.status(401).json({ valid: false, message: 'User not found or inactive' })
        }

        return res.status(200).json({
            valid: true,
            user:  decoded
        })

    } catch (err) {
        return res.status(401).json({ valid: false, message: 'Invalid token' })
    }
}

// ── Get current user ───────────────────────────────────────────────────────
const me = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' })
        }
        return res.status(200).json({ success: true, user: user.toPublic() })
    } catch (err) {
        next(err)
    }
}

// ── Helper: notify User Service to create profile ──────────────────────────
const notifyUserService = (userId, username, email) => {
    const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://localhost:4005'
    fetch(`${USER_SERVICE}/users/create-profile`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, username, email })
    }).catch(err => console.error('Failed to notify user service:', err.message))
}

module.exports = { register, login, logout, refresh, verify, me }
