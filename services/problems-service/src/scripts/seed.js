/**
 * seed.js — Seeds problems collection from Phase 1 problems.csv
 * Run: npm run seed
 */

require('dotenv').config({
    path: require('path').join(__dirname, '..', '..', '.env')
})

const mongoose = require('mongoose')
const fs       = require('fs')
const path     = require('path')
const { parse } = require('csv-parse/sync')
const Problem  = require('../models/Problem')

// Path to Phase 1 data
const CSV_PATH = path.join(__dirname, '..', '..', '..', '..', 'data', 'raw', 'problems.csv')

const parseTopics = (topicsStr) => {
    try {
        // CSV stores topics as Python list string: "['Array', 'Hash Table']"
        return JSON.parse(topicsStr.replace(/'/g, '"'))
    } catch {
        return []
    }
}

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('✅ MongoDB connected')

        // Read CSV
        if (!fs.existsSync(CSV_PATH)) {
            console.error(`❌ CSV not found at: ${CSV_PATH}`)
            console.error('   Make sure Phase 1 data is in PROD_1/data/raw/problems.csv')
            process.exit(1)
        }

        const content  = fs.readFileSync(CSV_PATH, 'utf-8')
        const records  = parse(content, {
            columns:          true,
            skip_empty_lines: true,
            trim:             true
        })

        console.log(`📂 Found ${records.length} problems in CSV`)

        // Clear existing
        await Problem.deleteMany({})
        console.log('🗑️  Cleared existing problems')

        // Transform and insert
        const problems = records.map(row => ({
            problemId:  parseInt(row.problem_id),
            title:      row.title,
            slug:       row.slug,
            difficulty: row.difficulty,
            acceptance: parseFloat(row.acceptance) || 0,
            frequency:  parseFloat(row.frequency)  || 0,
            topics:     parseTopics(row.topics),
            url:        `https://leetcode.com/problems/${row.slug}/`
        })).filter(p => !isNaN(p.problemId) && p.title && p.slug)

        // Insert in batches of 500
        const BATCH = 500
        for (let i = 0; i < problems.length; i += BATCH) {
            const batch = problems.slice(i, i + BATCH)
            await Problem.insertMany(batch, { ordered: false })
            console.log(`   Inserted ${Math.min(i + BATCH, problems.length)}/${problems.length}`)
        }

        console.log(`\n✅ Seeded ${problems.length} problems successfully`)

        // Print summary
        const counts = await Problem.aggregate([
            { $group: { _id: '$difficulty', count: { $sum: 1 } } }
        ])
        console.log('\n📊 Difficulty breakdown:')
        counts.forEach(c => console.log(`   ${c._id}: ${c.count}`))

        process.exit(0)

    } catch (err) {
        console.error('❌ Seed failed:', err.message)
        process.exit(1)
    }
}

seed()
