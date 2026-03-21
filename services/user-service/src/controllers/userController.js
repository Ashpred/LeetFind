/**
 * userController.js — Profile, dashboard, skill vector endpoints
 */

const Profile = require('../models/Profile')

const ML_SERVICE  = process.env.ML_SERVICE_URL  || 'http://localhost:8000'
const SOLVES_SVC  = process.env.SOLVES_SERVICE_URL || 'http://localhost:4003'

// ── POST /users/create-profile ─────────────────────────────────────────────
// Called by Auth Service after registration — fire and forget
const createProfile = async (req, res, next) => {
    try {
        const { userId, username, email } = req.body

        // Idempotent — don't fail if profile already exists
        const existing = await Profile.findOne({ userId })
        if (existing) {
            return res.status(200).json({ success: true, message: 'Profile already exists' })
        }

        await Profile.create({ userId, username, email })

        return res.status(201).json({ success: true, message: 'Profile created' })

    } catch (err) {
        next(err)
    }
}

// ── GET /users/profile ─────────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
    try {
        const userId  = req.headers['x-user-id']

        console.log('Looking for userId:', userId)

        // Also log what's in the DB
        const all = await Profile.find().select('userId username').limit(5)
        console.log('Profiles in DB:', all)


        const profile = await Profile.findOne({ userId })

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' })
        }

        return res.status(200).json({ success: true, data: { profile } })

    } catch (err) {
        next(err)
    }
}

// ── GET /users/dashboard ───────────────────────────────────────────────────
// Single endpoint that returns everything the dashboard needs
const getDashboard = async (req, res, next) => {
    try {
        const userId  = req.headers['x-user-id']
        const profile = await Profile.findOne({ userId })

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' })
        }

        // Fetch recent solves from Solves Service
        let recentSolves = []
        try {
            const solvesRes = await fetch(
                `${SOLVES_SVC}/solves/recent/${userId}?limit=5`,
                { signal: AbortSignal.timeout(5000) }
            )
            if (solvesRes.ok) {
                const solvesData = await solvesRes.json()
                recentSolves     = solvesData.data?.solves || []
            }
        } catch {
            console.warn('Could not fetch recent solves for dashboard')
        }

        // Build topic breakdown for radar chart
        const topicBreakdown = []
        for (const [topic, stats] of profile.topicStats.entries()) {
            topicBreakdown.push({
                topic,
                solved:    stats.solved,
                avgTime:   stats.solved > 0 ? Math.round(stats.totalTime / stats.solved) : 0,
                attempts:  stats.attempts
            })
        }

        return res.status(200).json({
            success: true,
            data: {
                stats:          profile.stats,
                skillVector:    profile.skillVector,
                topicBreakdown: topicBreakdown.sort((a, b) => b.solved - a.solved),
                recentSolves,
                username:       profile.username,
                memberSince:    profile.createdAt
            }
        })

    } catch (err) {
        next(err)
    }
}

// ── GET /users/skill-vector ────────────────────────────────────────────────
const getSkillVector = async (req, res, next) => {
    try {
        const userId  = req.headers['x-user-id']
        const profile = await Profile.findOne({ userId }).select('skillVector topicStats')

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' })
        }

        return res.status(200).json({
            success: true,
            data: {
                skillVector: profile.skillVector,
                topicStats:  Object.fromEntries(profile.topicStats)
            }
        })

    } catch (err) {
        next(err)
    }
}

// ── POST /users/update-skill ───────────────────────────────────────────────
// Called by Solves Service after a new solve — fire and forget
const updateSkill = async (req, res, next) => {
    try {
        const { userId, solveData, allSolves } = req.body

        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId required' })
        }

        const profile = await Profile.findOne({ userId })
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' })
        }

        // Update topic stats from new solve
        const { topics, timeTaken, attempts, difficulty } = solveData

        for (const topic of (topics || [])) {
            const existing = profile.topicStats.get(topic) || { solved: 0, totalTime: 0, attempts: 0 }
            profile.topicStats.set(topic, {
                solved:    existing.solved    + 1,
                totalTime: existing.totalTime + (timeTaken || 0),
                attempts:  existing.attempts  + (attempts  || 1)
            })
        }

        // Update aggregate stats
        profile.stats.totalSolved  += 1
        profile.stats.lastSolvedAt  = new Date()
        profile.stats.totalTime    += timeTaken || 0

        if (difficulty === 'Easy')   profile.stats.easySolved   += 1
        if (difficulty === 'Medium') profile.stats.mediumSolved += 1
        if (difficulty === 'Hard')   profile.stats.hardSolved   += 1

        // Update streak
        const lastSolved = profile.stats.lastSolvedAt
        const yesterday  = new Date(Date.now() - 86400000)
        if (lastSolved && new Date(lastSolved) >= yesterday) {
            profile.stats.streak += 1
        } else {
            profile.stats.streak = 1
        }

        // Invalidate rec cache — new solve means new recommendations needed
        profile.invalidateRecCache()

        // Call ML service to recompute skill vector
        if (allSolves && allSolves.length > 0) {
            try {
                const mlRes = await fetch(`${ML_SERVICE}/update-skill/${userId}`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ solves: allSolves }),
                    signal:  AbortSignal.timeout(10000)
                })
                if (mlRes.ok) {
                    const mlData         = await mlRes.json()
                    profile.skillVector  = mlData.skill_vector
                }
            } catch {
                console.warn('ML skill update failed — keeping existing skill vector')
            }
        }

        await profile.save()

        return res.status(200).json({
            success: true,
            message: 'Skill updated',
            data: {
                stats:       profile.stats,
                skillVector: profile.skillVector
            }
        })

    } catch (err) {
        next(err)
    }
}

module.exports = {
    createProfile,
    getProfile,
    getDashboard,
    getSkillVector,
    updateSkill
}
