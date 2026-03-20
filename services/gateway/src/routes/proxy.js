/**
 * proxy.js — Manual HTTP proxy using native fetch
 * Avoids http-proxy-middleware v3 pathRewrite issues
 */

const forwardRequest = (targetBase, stripPrefix) => async (req, res) => {
    try {
        // Strip /api from path, keep the rest
        const newPath = req.originalUrl.replace('/api', '')
        const url     = `${targetBase}${newPath}`

        console.log(`[Proxy] ${req.method} ${req.originalUrl} → ${url}`)

        // Forward headers
        const headers = {
            'Content-Type': 'application/json',   // ← force this always
            'x-user-id':       req.headers['x-user-id']       || '',
            'x-user-email':    req.headers['x-user-email']    || '',
            'x-user-username': req.headers['x-user-username'] || '',
        }

        // Forward cookies
        if (req.headers.cookie) {
            headers['cookie'] = req.headers.cookie
        }

        // Forward Authorization header if present
        if (req.headers.authorization) {
            headers['authorization'] = req.headers.authorization
        }

        const fetchOptions = {
            method:  req.method,
            headers,
            signal:  AbortSignal.timeout(10000),   // 10s timeout, native Node 24
        }

        // Attach body for non-GET requests
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            fetchOptions.body = JSON.stringify(req.body)
            console.log(`[Proxy Body] ${JSON.stringify(req.body)}`)
        }

        const response = await fetch(url, fetchOptions)

        // Forward response headers back (especially Set-Cookie)
        response.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'transfer-encoding') {
                res.setHeader(key, value)
            }
        })

        const data = await response.json()
        return res.status(response.status).json(data)

    } catch (err) {
        console.error(`[Proxy Error] ${err.message}`)
        if (err.name === 'TimeoutError') {
            return res.status(504).json({ success: false, message: 'Service timed out' })
        }
        return res.status(502).json({ success: false, message: 'Service unavailable' })
    }
}

const createProxies = () => ({
    auth:            forwardRequest(process.env.AUTH_SERVICE_URL     || 'http://localhost:4001'),
    problems:        forwardRequest(process.env.PROBLEMS_SERVICE_URL || 'http://localhost:4002'),
    solves:          forwardRequest(process.env.SOLVES_SERVICE_URL   || 'http://localhost:4003'),
    recommendations: forwardRequest(process.env.RECS_SERVICE_URL     || 'http://localhost:4004'),
    users:           forwardRequest(process.env.USER_SERVICE_URL     || 'http://localhost:4005'),
})

module.exports = { createProxies }