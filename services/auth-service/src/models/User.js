/**
 * User.js — Auth User Model
 * Owns: identity, credentials, tokens only
 * Profile/stats live in User Service
 */

const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const userSchema = new mongoose.Schema({
    username: {
        type:      String,
        required:  [true, 'Username is required'],
        unique:    true,
        trim:      true,
        minlength: [3,  'Username must be at least 3 characters'],
        maxlength: [30, 'Username must be at most 30 characters'],
        match:     [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, underscores']
    },
    email: {
        type:     String,
        required: [true, 'Email is required'],
        unique:   true,
        trim:     true,
        lowercase: true,
        match:    [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    passwordHash: {
        type:     String,
        required: true,
        select:   false    // never returned in queries by default
    },
    refreshToken: {
        type:   String,
        select: false
    },
    isActive: {
        type:    Boolean,
        default: true
    }
}, {
    timestamps: true,      // createdAt, updatedAt
    collection: 'auth.users'
})

// ── Hash password before save ──────────────────────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next()
    const rounds      = parseInt(process.env.BCRYPT_ROUNDS) || 12
    this.passwordHash = await bcrypt.hash(this.passwordHash, rounds)
    next()
})

// ── Instance method: compare password ─────────────────────────────────────
userSchema.methods.comparePassword = async function (plaintext) {
    return bcrypt.compare(plaintext, this.passwordHash)
}

// ── Instance method: safe public representation ────────────────────────────
userSchema.methods.toPublic = function () {
    return {
        id:        this._id,
        username:  this.username,
        email:     this.email,
        createdAt: this.createdAt
    }
}

module.exports = mongoose.model('User', userSchema)
