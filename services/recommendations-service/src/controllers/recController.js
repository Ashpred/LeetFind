/**
 * recController.js — Fetch recommendations with caching
 */

const RecCache   = require('../models/RecCache')

const ML_SVC     = process.env.ML_SERVICE_URL  || 'http://localhost:8000'
const SOLVES_SVC = process.env.SOLVES_SERVICE_URL || 'http://localhost:4003'

// ── GET /recommendations ───────────────────────────────────────────────────
const getRecommendations = async (req, res, next) => {
    try {
        const userId     = req.headers['x-user-id']
        const { n = 10, topic, difficulty } = req.query

        // ── 1. Check cache ─────────────────────────────────────────────────
        const cached = await RecCache.findOne({ userId })
        if (cached && cached.recs.length > 0) {
            let recs = cached.recs

            // Apply optional filters on cached results
            if (topic)      recs = recs.filter(r => r.topics.includes(topic))
            if (difficulty) recs = recs.filter(r => r.difficulty === difficulty)

            return res.status(200).json({
                success: true,
                data: {
                    recommendations: recs.slice(0, parseInt(n)),
                    cached:          true,
                    cachedAt:        cached.cachedAt
                }
            })
        }

        // ── 2. Fetch solved IDs from Solves Service ────────────────────────
        let solvedIds = []
        try {
            const solvesRes = await fetch(
                `${SOLVES_SVC}/solves/ids?userId=${userId}`,
                { signal: AbortSignal.timeout(5000) }
            )
            if (solvesRes.ok) {
                const data = await solvesRes.json()
                solvedIds  = data.data?.solvedIds || []
            }
        } catch {
            console.warn('Could not fetch solved IDs — recommending from full catalog')
        }

        // ── 3. Call ML Service ─────────────────────────────────────────────
        // Request more than needed so we have buffer for filtering
        const mlN   = Math.max(parseInt(n) * 3, 30)
        const mlUserId = 0   // cold start fallback
        let mlUrl = `${ML_SVC}/recommend/${mlUserId}?n=${mlN}`
        if (topic)      mlUrl += `&topic=${encodeURIComponent(topic)}`
        if (difficulty) mlUrl += `&difficulty=${encodeURIComponent(difficulty)}`

        const mlRes = await fetch(mlUrl, { signal: AbortSignal.timeout(30000) })

        if (!mlRes.ok) {
            throw new Error(`ML service error: ${mlRes.status}`)
        }

        const mlData = await mlRes.json()
        let recs     = mlData.recommendations || []

        // ── 4. Filter out already solved problems ──────────────────────────
        const solvedSet = new Set(solvedIds)
        recs = recs.filter(r => !solvedSet.has(r.problem_id))

        // ── 5. Cache the full unfiltered result ────────────────────────────
        await RecCache.findOneAndUpdate(
            { userId },
            { userId, recs: mlData.recommendations, cachedAt: new Date() },
            { upsert: true, new: true }
        )

        // Apply filters after caching
        if (topic)      recs = recs.filter(r => r.topics.includes(topic))
        if (difficulty) recs = recs.filter(r => r.difficulty === difficulty)

        return res.status(200).json({
            success: true,
            data: {
                recommendations: recs.slice(0, parseInt(n)),
                cached:          false,
                count:           recs.length
            }
        })

    } catch (err) {
        console.error(`[Recs Error] ${err.message}`)
        next(err)
    }
}

// ── POST /recommendations/invalidate ──────────────────────────────────────
// Called by Solves Service after a new solve — fire and forget
const invalidateCache = async (req, res, next) => {
    try {
        const { userId } = req.body
        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId required' })
        }

        await RecCache.findOneAndDelete({ userId })
        console.log(`♻️  Cache invalidated for user ${userId}`)

        return res.status(200).json({ success: true, message: 'Cache invalidated' })

    } catch (err) {
        next(err)
    }
}

// ── GET /recommendations/health-check ─────────────────────────────────────
// Checks if ML service is reachable
const checkMlHealth = async (req, res) => {
    try {
        const mlRes = await fetch(`${ML_SVC}/health`, {
            signal: AbortSignal.timeout(3000)
        })
        const data  = await mlRes.json()
        return res.status(200).json({ success: true, ml: data })
    } catch {
        return res.status(503).json({ success: false, message: 'ML service unreachable' })
    }
}

module.exports = { getRecommendations, invalidateCache, checkMlHealth }
