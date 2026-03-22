// src/services/api.js — Axios instance with interceptors
import axios from 'axios'

const api = axios.create({
    baseURL:         '/api',
    withCredentials: true,    // send cookies
    headers: { 'Content-Type': 'application/json' }
})

// ── Request interceptor — attach token from localStorage ──────────────────
api.interceptors.request.use(config => {
    const token = localStorage.getItem('accessToken')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// ── Response interceptor — handle token expiry ────────────────────────────
api.interceptors.response.use(
    res => res,
    async err => {
        const original = err.config
        if (err.response?.status === 401 &&
            err.response?.data?.code === 'TOKEN_EXPIRED' &&
            !original._retry) {
            original._retry = true
            try {
                const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
                const newToken = res.data.accessToken
                localStorage.setItem('accessToken', newToken)
                original.headers.Authorization = `Bearer ${newToken}`
                return api(original)
            } catch {
                localStorage.removeItem('accessToken')
                window.location.href = '/login'
            }
        }
        return Promise.reject(err)
    }
)

// ── API methods ───────────────────────────────────────────────────────────
export const authAPI = {
    register: (data)     => api.post('/auth/register', data),
    login:    (data)     => api.post('/auth/login', data),
    logout:   ()         => api.post('/auth/logout'),
    me:       ()         => api.get('/auth/me'),
}

export const problemsAPI = {
    getAll:    (params)  => api.get('/problems', { params }),
    getBySlug: (slug)    => api.get(`/problems/${slug}`),
    getSimilar:(slug, k) => api.get(`/problems/${slug}/similar`, { params: { k } }),
    getTopics: ()        => api.get('/problems/topics'),
    getStats:  ()        => api.get('/problems/stats'),
}

export const solvesAPI = {
    log:        (data)   => api.post('/solves', data),
    getHistory: (params) => api.get('/solves/history', { params }),
    check:      (id)     => api.get(`/solves/check/${id}`),
    getIds:     ()       => api.get('/solves/ids'),
}

export const usersAPI = {
    getProfile:     ()   => api.get('/users/profile'),
    getDashboard:   ()   => api.get('/users/dashboard'),
    getSkillVector: ()   => api.get('/users/skill-vector'),
}

export const recsAPI = {
    get:     (params)    => api.get('/recommendations', { params }),
    mlHealth:()          => api.get('/recommendations/ml-health'),
}

export default api
