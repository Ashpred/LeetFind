/**
 * RecCache.js — Recommendation cache model
 * TTL index auto-expires documents after 1 hour
 */

const mongoose = require('mongoose')

const recItemSchema = new mongoose.Schema({
    problemId:  Number,
    title:      String,
    slug:       String,
    difficulty: String,
    topics:     [String],
    acceptance: Number,
    score:      Number,
    cf_score:   Number,
    cb_score:   Number,
    wa_score:   Number,
    diff_score: Number,
}, { _id: false })

const recCacheSchema = new mongoose.Schema({
    userId: {
        type:     String,
        required: true,
        unique:   true,
        index:    true
    },
    recs:     { type: [recItemSchema], default: [] },
    cachedAt: { type: Date, default: Date.now }
}, {
    collection: 'recommendations.cache'
})

// ── TTL index — MongoDB auto-deletes documents after 1 hour ───────────────
recCacheSchema.index({ cachedAt: 1 }, { expireAfterSeconds: 3600 })

module.exports = mongoose.model('RecCache', recCacheSchema)
