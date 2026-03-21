/**
 * Solve.js — Individual solve event model
 */

const mongoose = require('mongoose')

const solveSchema = new mongoose.Schema({
    userId:     { type: String,  required: true, index: true },
    problemId:  { type: Number,  required: true },
    title:      { type: String,  required: true },
    slug:       { type: String,  required: true },
    difficulty: { type: String,  enum: ['Easy', 'Medium', 'Hard'] },
    topics:     { type: [String], default: [] },
    timeTaken:  { type: Number,  default: 0 },   // seconds
    attempts:   { type: Number,  default: 1 },
    rating:     { type: Number,  default: 1.0 },  // 1.0=clean, 0.7=struggled
    solvedAt:   { type: Date,    default: Date.now }
}, {
    timestamps: true,
    collection: 'solves.history'
})

// Compound index — fast lookup of user's solve history
solveSchema.index({ userId: 1, solvedAt: -1 })

// Prevent duplicate solves for same user+problem
solveSchema.index({ userId: 1, problemId: 1 }, { unique: true })

module.exports = mongoose.model('Solve', solveSchema)
