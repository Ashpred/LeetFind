/**
 * Profile.js — User profile model
 * Owns: stats, skill vector, topic breakdown, rec cache
 * Identity/credentials live in Auth Service
 */

const mongoose = require('mongoose')

const topicStatSchema = new mongoose.Schema({
    solved:     { type: Number, default: 0 },
    totalTime:  { type: Number, default: 0 },  // seconds
    attempts:   { type: Number, default: 0 },
}, { _id: false })

const profileSchema = new mongoose.Schema({
    userId:   {
        type:     String,
        required: true,
        unique:   true,
        index:    true
    },
    username: { type: String, required: true },
    email:    { type: String, required: true },

    // Aggregate stats
    stats: {
        totalSolved:  { type: Number, default: 0 },
        easySolved:   { type: Number, default: 0 },
        mediumSolved: { type: Number, default: 0 },
        hardSolved:   { type: Number, default: 0 },
        streak:       { type: Number, default: 0 },
        lastSolvedAt: { type: Date,   default: null },
        totalTime:    { type: Number, default: 0 },  // seconds
    },

    // Per-topic mastery stats
    topicStats: {
        type: Map,
        of:   topicStatSchema,
        default: {}
    },

    // 20-dim skill vector from ML service
    skillVector: {
        type:    [Number],
        default: new Array(20).fill(0)
    },

    // Recommendation cache — invalidated on new solve
    recCache: {
        recs:     { type: Array,  default: [] },
        cachedAt: { type: Date,   default: null },
        ttlHours: { type: Number, default: 1 }
    }

}, {
    timestamps: true,
    collection: 'users.profiles'
})

// ── Instance method: check if rec cache is valid ───────────────────────────
profileSchema.methods.isRecCacheValid = function () {
    if (!this.recCache.cachedAt || !this.recCache.recs.length) return false
    const ttlMs   = this.recCache.ttlHours * 60 * 60 * 1000
    const elapsed = Date.now() - new Date(this.recCache.cachedAt).getTime()
    return elapsed < ttlMs
}

// ── Instance method: invalidate rec cache ──────────────────────────────────
profileSchema.methods.invalidateRecCache = function () {
    this.recCache.recs     = []
    this.recCache.cachedAt = null
}

module.exports = mongoose.model('Profile', profileSchema)
