/**
 * solves.js — Solve routes
 */

const express = require('express')
const router  = express.Router()
const {
    logSolve,
    getHistory,
    getRecent,
    checkSolved,
    getSolvedIds
} = require('../controllers/solveController')

router.post('/',                  logSolve)     // POST   /solves
router.get ('/history',           getHistory)   // GET    /solves/history
router.get ('/ids',               getSolvedIds) // GET    /solves/ids
router.get ('/recent/:userId',    getRecent)    // GET    /solves/recent/:userId  (internal)
router.get ('/check/:problemId',  checkSolved)  // GET    /solves/check/:problemId

module.exports = router
