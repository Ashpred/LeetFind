/**
 * problemController.js — Problem catalog endpoints
 */

const Problem = require('../models/Problem')

// ── GET /problems ──────────────────────────────────────────────────────────
// Paginated + filtered problem list
const getProblems = async (req, res, next) => {
    try {
        const {
            difficulty,
            topic,
            search,
            page  = 1,
            limit = 20,
            sort  = 'frequency'   // frequency | acceptance | problemId
        } = req.query

        const filter = {}

        // Difficulty filter
        if (difficulty && ['Easy', 'Medium', 'Hard'].includes(difficulty)) {
            filter.difficulty = difficulty
        }

        // Topic filter
        if (topic) {
            filter.topics = { $in: [topic] }
        }

        // Text search on title
        if (search) {
            filter.$text = { $search: search }
        }

        // Sort options
        const sortMap = {
            frequency:  { frequency: -1 },
            acceptance: { acceptance: -1 },
            problemId:  { problemId:  1  },
            difficulty: { difficulty:  1  }
        }
        let sortOption = sortMap[sort] || { frequency: -1 }
        
        if (search) {
            sortOption = { score: { $meta: 'textScore' }, ...sortOption }
        }

        const skip  = (parseInt(page) - 1) * parseInt(limit)
        const total = await Problem.countDocuments(filter)

        const problems = await Problem
            .find(filter, search ? { score: { $meta: 'textScore' } } : {})
            .sort(sortOption)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v')

        return res.status(200).json({
            success: true,
            data: {
                problems,
                pagination: {
                    total,
                    page:       parseInt(page),
                    limit:      parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    hasNext:    skip + problems.length < total,
                    hasPrev:    parseInt(page) > 1
                }
            }
        })

    } catch (err) {
        next(err)
    }
}

// ── GET /problems/topics ───────────────────────────────────────────────────
// Returns all unique topics for filter dropdowns
const getTopics = async (req, res, next) => {
    try {
        const topics = await Problem.distinct('topics')
        return res.status(200).json({
            success: true,
            data:    { topics: topics.sort() }
        })
    } catch (err) {
        next(err)
    }
}

// ── GET /problems/:slug ────────────────────────────────────────────────────
const getProblemBySlug = async (req, res, next) => {
    try {
        const problem = await Problem
            .findOne({ slug: req.params.slug })
            .select('-__v')

        if (!problem) {
            return res.status(404).json({
                success: false,
                message: 'Problem not found'
            })
        }

        return res.status(200).json({
            success: true,
            data:    { problem }
        })

    } catch (err) {
        next(err)
    }
}

// ── GET /problems/:slug/similar ────────────────────────────────────────────
// Calls ML service for content-based similar problems
const getSimilarProblems = async (req, res, next) => {
    try {
        const problem = await Problem.findOne({ slug: req.params.slug })
        if (!problem) {
            return res.status(404).json({
                success: false,
                message: 'Problem not found'
            })
        }

        const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'
        const k      = req.query.k || 5

        const response = await fetch(
            `${ML_URL}/similar/${problem.problemId}?k=${k}`,
            { signal: AbortSignal.timeout(10000) }
        )

        if (!response.ok) {
            throw new Error(`ML service error: ${response.status}`)
        }

        const mlData = await response.json()

        // Enrich with full problem details from DB
        const similarIds = mlData.similar_problems.map(p => p.problem_id)
        const dbProblems = await Problem.find({
            problemId: { $in: similarIds }
        }).select('-__v')

        // Merge similarity score with DB data
        const enriched = mlData.similar_problems.map(mlP => {
            const dbP = dbProblems.find(p => p.problemId === mlP.problem_id)
            return { ...mlP, ...(dbP ? dbP.toObject() : {}) }
        })

        return res.status(200).json({
            success: true,
            data:    {
                problem:         { id: problem.problemId, title: problem.title },
                similarProblems: enriched
            }
        })

    } catch (err) {
        next(err)
    }
}

// ── GET /problems/stats ────────────────────────────────────────────────────
// Catalog statistics
const getStats = async (req, res, next) => {
    try {
        const [total, breakdown] = await Promise.all([
            Problem.countDocuments(),
            Problem.aggregate([
                { $group: { _id: '$difficulty', count: { $sum: 1 } } }
            ])
        ])

        const stats = { total }
        breakdown.forEach(b => { stats[b._id.toLowerCase()] = b.count })

        return res.status(200).json({ success: true, data: { stats } })
    } catch (err) {
        next(err)
    }
}

module.exports = {
    getProblems,
    getTopics,
    getProblemBySlug,
    getSimilarProblems,
    getStats
}
