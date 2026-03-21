/**
 * Problem.js — Problem catalog model
 * Seeded from Phase 1 problems.csv
 */

const mongoose = require('mongoose')

const problemSchema = new mongoose.Schema({
    problemId:  { type: Number, required: true, unique: true },
    title:      { type: String, required: true },
    slug:       { type: String, required: true, unique: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    acceptance: { type: Number, default: 0 },
    frequency:  { type: Number, default: 0 },
    topics:     { type: [String], default: [] },
    url:        { type: String, default: '' },
}, {
    timestamps: true,
    collection: 'problems.catalog'
})

// ── Indexes for fast filtering ─────────────────────────────────────────────
problemSchema.index({ difficulty: 1 })
problemSchema.index({ topics: 1 })
problemSchema.index({ title: 'text' })   // text search
problemSchema.index({ frequency: -1 })   // sort by frequency

module.exports = mongoose.model('Problem', problemSchema)
