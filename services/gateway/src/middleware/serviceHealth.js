/**
 * serviceHealth.js — Checks health of all downstream services
 * Called by GET /health on the gateway
 */


const SERVICES = {
    auth:            process.env.AUTH_SERVICE_URL     || 'http://localhost:4001',
    problems:        process.env.PROBLEMS_SERVICE_URL || 'http://localhost:4002',
    solves:          process.env.SOLVES_SERVICE_URL   || 'http://localhost:4003',
    recommendations: process.env.RECS_SERVICE_URL     || 'http://localhost:4004',
    users:           process.env.USER_SERVICE_URL     || 'http://localhost:4005',
    ml:              'http://localhost:8000',
}

const checkService = async (name, url) => {
    try {
        const controller = new AbortController()
        const timeoutId  = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(`${url}/health`, {
            signal: controller.signal
        })
        clearTimeout(timeoutId)
        return res.ok ? 'up' : 'degraded'
    } catch {
        return 'down'
    }
}

const checkAll = async () => {
    const results = await Promise.allSettled(
        Object.entries(SERVICES).map(async ([name, url]) => ({
            name,
            status: await checkService(name, url)
        }))
    )
    return Object.fromEntries(
        results.map(r => [r.value.name, r.value.status])
    )
}

module.exports = { checkAll }
