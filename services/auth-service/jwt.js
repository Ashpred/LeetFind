/**
 * jwt.js — JWT token generation and verification utilities
 */

const jwt = require('jsonwebtoken')

const SECRET          = process.env.JWT_SECRET
const EXPIRES_IN      = process.env.JWT_EXPIRES_IN      || '7d'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d'

/**
 * Generate access token — short lived, used for API auth
 */
const generateAccessToken = (payload) => {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN })
}

/**
 * Generate refresh token — long lived, used to rotate access tokens
 */
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, SECRET, { expiresIn: REFRESH_EXPIRES })
}

/**
 * Verify a token — returns decoded payload or throws
 */
const verifyToken = (token) => {
    return jwt.verify(token, SECRET)
}

/**
 * Generate both tokens at once — used on login/register
 */
const generateTokenPair = (user) => {
    const payload = {
        id:       user._id,
        username: user.username,
        email:    user.email
    }
    return {
        accessToken:  generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload)
    }
}

/**
 * Set tokens as httpOnly cookies on response
 * httpOnly = JS can't access → XSS safe
 * sameSite = CSRF protection
 */
const setTokenCookies = (res, accessToken, refreshToken) => {
    const isProd = process.env.NODE_ENV === 'production'

    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure:   isProd,
        sameSite: 'strict',
        maxAge:   7 * 24 * 60 * 60 * 1000   // 7 days in ms
    })

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure:   isProd,
        sameSite: 'strict',
        maxAge:   30 * 24 * 60 * 60 * 1000  // 30 days in ms
    })
}

const clearTokenCookies = (res) => {
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateTokenPair,
    verifyToken,
    setTokenCookies,
    clearTokenCookies
}
