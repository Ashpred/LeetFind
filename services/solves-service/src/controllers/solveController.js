/**
 * solveController.js — Log solves, fetch history, notify downstream
 */

const Solve = require('../models/Solve')

const USER_SVC     = process.env.USER_SERVICE_URL     || 'http://localhost:4005'
const RECS_SVC     = process.env.RECS_SERVICE_URL     || 'http://localhost:4004'
const PROBLEMS_SVC = process.env.PROBLEMS_SERVICE_URL || 'http://localhost:4002'

// ── Fire and forget helper ─────────────────────────────────────────────────
const notify = (url, body) => {
    fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(10000)
    }).catch(err => console.error(`[Notify Failed] ${url}: ${err.message}`))
}

// ── POST /solves ───────────────────────────────────────────────────────────
const logSolve = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id']
        const { problemId, timeTaken, attempts } = req.body

        if (!problemId) {
            return res.status(400).json({ success: false, message: 'problemId required' })
        }

        // Fetch problem details from Problems Service
        let problem = null
        try {
            const probRes = await fetch(
                `${PROBLEMS_SVC}/problems/${req.body.slug}`,
                { signal: AbortSignal.timeout(5000) }
            )
            if (probRes.ok) {
                const probData = await probRes.json()
                problem        = probData.data?.problem
            }
        } catch {
            console.warn('Could not fetch problem details')
        }

        // Compute rating based on attempts and time
        const rating = attempts <= 1 ? 1.0 : attempts <= 3 ? 0.85 : 0.7

        // Upsert — allow re-solving (updates time/attempts)
        const solve = await Solve.findOneAndUpdate(
            { userId, problemId },
            {
                userId,
                problemId,
                title:      problem?.title      || req.body.title      || 'Unknown',
                slug:       problem?.slug       || req.body.slug       || '',
                difficulty: problem?.difficulty || req.body.difficulty || 'Medium',
                topics:     problem?.topics     || req.body.topics     || [],
                timeTaken:  timeTaken  || 0,
                attempts:   attempts   || 1,
                rating,
                solvedAt:   new Date()
            },
            { upsert: true, new: true }
        )

        // Respond immediately — don't wait for downstream notifications
        res.status(201).json({
            success: true,
            message: 'Solve logged',
            data:    { solve }
        })

        // ── Async notifications (fire and forget) ─────────────────────────
        // 1. Fetch all user solves for skill vector recomputation
        const allSolves = await Solve.find({ userId }).select('topics timeTaken attempts difficulty rating')

        // 2. Notify User Service to update stats + skill vector
        notify(`${USER_SVC}/users/update-skill`, {
            userId,
            solveData: {
                topics:     solve.topics,
                timeTaken:  solve.timeTaken,
                attempts:   solve.attempts,
                difficulty: solve.difficulty
            },
            allSolves: allSolves.map(s => ({
                topics:     s.topics,
                time_taken: s.timeTaken,
                attempts:   s.attempts,
                difficulty: s.difficulty,
                rating:     s.rating
            }))
        })

        // 3. Notify Recs Service to invalidate cache
        notify(`${RECS_SVC}/recommendations/invalidate`, { userId })

    } catch (err) {
        // Handle duplicate key gracefully
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Problem already solved — use PUT to update'
            })
        }
        next(err)
    }
}

// ── GET /solves/history ────────────────────────────────────────────────────
const getHistory = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id']
        const { page = 1, limit = 20, difficulty, topic } = req.query

        const filter = { userId }
        if (difficulty) filter.difficulty = difficulty
        if (topic)      filter.topics     = { $in: [topic] }

        const skip  = (parseInt(page) - 1) * parseInt(limit)
        const total = await Solve.countDocuments(filter)

        const solves = await Solve
            .find(filter)
            .sort({ solvedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v')

        return res.status(200).json({
            success: true,
            data: {
                solves,
                pagination: {
                    total,
                    page:       parseInt(page),
                    limit:      parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    hasNext:    skip + solves.length < total,
                    hasPrev:    parseInt(page) > 1
                }
            }
        })

    } catch (err) {
        next(err)
    }
}

// ── GET /solves/recent/:userId ─────────────────────────────────────────────
// Called internally by User Service for dashboard
const getRecent = async (req, res, next) => {
    try {
        const { userId } = req.params
        const limit      = parseInt(req.query.limit) || 5

        const solves = await Solve
            .find({ userId })
            .sort({ solvedAt: -1 })
            .limit(limit)
            .select('title slug difficulty topics timeTaken solvedAt')

        return res.status(200).json({ success: true, data: { solves } })

    } catch (err) {
        next(err)
    }
}

// ── GET /solves/check/:problemId ───────────────────────────────────────────
// Check if current user has solved a specific problem
const checkSolved = async (req, res, next) => {
    try {
        const userId    = req.headers['x-user-id']
        const problemId = parseInt(req.params.problemId)
        const solve     = await Solve.findOne({ userId, problemId })

        return res.status(200).json({
            success: true,
            data:    { solved: !!solve, solve: solve || null }
        })

    } catch (err) {
        next(err)
    }
}

// ── GET /solves/ids ────────────────────────────────────────────────────────
// Returns just the problemIds the user has solved — used by Recs Service
const getSolvedIds = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'] || req.query.userId
        const solves = await Solve.find({ userId }).select('problemId -_id')
        const ids    = solves.map(s => s.problemId)

        return res.status(200).json({ success: true, data: { solvedIds: ids } })

    } catch (err) {
        next(err)
    }
}

module.exports = { logSolve, getHistory, getRecent, checkSolved, getSolvedIds }
