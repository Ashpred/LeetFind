/**
 * recommendations.js — Recommendation routes
 */

const express = require('express')
const router  = express.Router()
const {
    getRecommendations,
    invalidateCache,
    checkMlHealth
} = require('../controllers/recController')

router.get ('/',            getRecommendations)  // GET  /recommendations?n=10&topic=DP
router.post('/invalidate',  invalidateCache)     // POST /recommendations/invalidate
router.get ('/ml-health',   checkMlHealth)       // GET  /recommendations/ml-health

module.exports = router
