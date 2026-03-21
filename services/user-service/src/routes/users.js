/**
 * users.js — User routes
 */

const express = require('express')
const router  = express.Router()
const {
    createProfile,
    getProfile,
    getDashboard,
    getSkillVector,
    updateSkill
} = require('../controllers/userController')

router.post('/create-profile', createProfile)  // called by auth service
router.get ('/profile',        getProfile)
router.get ('/dashboard',      getDashboard)
router.get ('/skill-vector',   getSkillVector)
router.post('/update-skill',   updateSkill)    // called by solves service

module.exports = router
