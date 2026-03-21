/**
 * problems.js — Problem routes
 * All routes protected by gateway auth middleware
 * x-user-id header injected by gateway
 */

const express = require('express')
const router  = express.Router()
const {
    getProblems,
    getTopics,
    getProblemBySlug,
    getSimilarProblems,
    getStats
} = require('../controllers/problemController')

// Order matters — specific routes before parameterized ones
router.get('/',              getProblems)         // GET /problems?difficulty=Easy&topic=Array
router.get('/topics',        getTopics)           // GET /problems/topics
router.get('/stats',         getStats)            // GET /problems/stats
router.get('/:slug',         getProblemBySlug)    // GET /problems/two-sum
router.get('/:slug/similar', getSimilarProblems)  // GET /problems/two-sum/similar

module.exports = router
