// src/pages/DashboardPage.jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box, Container, Grid, Typography, Card, CardContent,
    Stack, Chip, Avatar, Button, Skeleton, Divider
} from '@mui/material'
import AutoAwesomeIcon  from '@mui/icons-material/AutoAwesome'
import EmojiEventsIcon  from '@mui/icons-material/EmojiEvents'
import WhatshotIcon     from '@mui/icons-material/Whatshot'
import TimerIcon        from '@mui/icons-material/Timer'
import TrendingUpIcon   from '@mui/icons-material/TrendingUp'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis,
    ResponsiveContainer, Tooltip
} from 'recharts'
import { fetchDashboard } from '../store/slices/userSlice'
import { fetchRecommendations } from '../store/slices/recsSlice'

const TOPICS = [
    'Array','String','Hash Table','Dynamic Programming','Math',
    'Sorting','Greedy','Depth-First Search','Breadth-First Search',
    'Binary Search','Tree','Graph','Backtracking','Stack','Heap',
    'Linked List','Sliding Window','Two Pointers','Trie','Union Find'
]

const DIFF_COLORS = { Easy: '#4ade80', Medium: '#f59e0b', Hard: '#f87171' }

const fmtTime = secs => {
    if (!secs) return '—'
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function StatCard({ icon, label, value, color = 'primary.main' }) {
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Stack direction='row' alignItems='center' spacing={1.5}>
                    <Avatar sx={{ bgcolor: `${color}15`, color, width: 44, height: 44 }}>
                        {icon}
                    </Avatar>
                    <Box>
                        <Typography variant='h5' fontWeight={700}>{value ?? '—'}</Typography>
                        <Typography variant='caption' color='text.secondary'>{label}</Typography>
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    )
}

export default function DashboardPage() {
    const dispatch  = useDispatch()
    const navigate  = useNavigate()
    const { user }  = useSelector(state => state.auth)
    const { dashboard, skillVector, topicBreakdown, loading } = useSelector(state => state.user)
    const { items: recs, loading: recsLoading } = useSelector(state => state.recs)

    useEffect(() => {
        dispatch(fetchDashboard())
        dispatch(fetchRecommendations({ n: 5 }))
    }, [dispatch])

    // Build radar data from skill vector
    const radarData = TOPICS.slice(0, 10).map((topic, i) => ({
        topic:   topic.length > 12 ? topic.slice(0, 12) + '…' : topic,
        mastery: Math.round((skillVector[i] || 0) * 100)
    }))

    const stats = dashboard?.stats || {}

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
            <Container maxWidth='xl'>

                {/* Header */}
                <Box mb={4}>
                    <Typography variant='h4' fontWeight={700}>
                        Welcome back, {user?.username} 👋
                    </Typography>
                    <Typography color='text.secondary'>
                        Here's your progress overview and today's recommendations
                    </Typography>
                </Box>

                {/* Stat cards */}
                <Grid container spacing={2} mb={4}>
                    {[
                        { icon: <EmojiEventsIcon />, label: 'Problems Solved', value: stats.totalSolved || 0,   color: '#6366f1' },
                        { icon: <WhatshotIcon />,    label: 'Day Streak',      value: stats.streak || 0,        color: '#f59e0b' },
                        { icon: <TimerIcon />,       label: 'Avg Solve Time',  value: fmtTime(stats.totalSolved ? Math.round((stats.totalTime || 0) / stats.totalSolved) : 0), color: '#4ade80' },
                        { icon: <TrendingUpIcon />,  label: 'Hard Solved',     value: stats.hardSolved || 0,    color: '#f87171' },
                    ].map(s => (
                        <Grid item xs={6} md={3} key={s.label}>
                            {loading
                                ? <Skeleton variant='rounded' height={88} sx={{ borderRadius: 3 }} />
                                : <StatCard {...s} />}
                        </Grid>
                    ))}
                </Grid>

                <Grid container spacing={3}>

                    {/* Skill Radar */}
                    <Grid item xs={12} md={5}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant='h6' fontWeight={600} mb={3}>
                                    Topic Mastery
                                </Typography>
                                {loading
                                    ? <Skeleton variant='circular' width={280} height={280} sx={{ mx: 'auto' }} />
                                    : (
                                        <ResponsiveContainer width='100%' height={280}>
                                            <RadarChart data={radarData}>
                                                <PolarGrid stroke='#2d2d2d' />
                                                <PolarAngleAxis
                                                    dataKey='topic'
                                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                                />
                                                <Radar
                                                    dataKey='mastery'
                                                    stroke='#6366f1'
                                                    fill='#6366f1'
                                                    fillOpacity={0.25}
                                                    strokeWidth={2}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        bgcolor: '#1a1a1a',
                                                        border: '1px solid #2d2d2d',
                                                        borderRadius: 8
                                                    }}
                                                    formatter={v => [`${v}%`, 'Mastery']}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    )}

                                {/* Difficulty breakdown */}
                                <Divider sx={{ my: 2, borderColor: '#2d2d2d' }} />
                                <Stack direction='row' spacing={2} justifyContent='center'>
                                    {[
                                        { label: 'Easy',   count: stats.easySolved   || 0, color: '#4ade80' },
                                        { label: 'Medium', count: stats.mediumSolved || 0, color: '#f59e0b' },
                                        { label: 'Hard',   count: stats.hardSolved   || 0, color: '#f87171' },
                                    ].map(d => (
                                        <Box key={d.label} textAlign='center'>
                                            <Typography variant='h6' fontWeight={700} sx={{ color: d.color }}>
                                                {d.count}
                                            </Typography>
                                            <Typography variant='caption' color='text.secondary'>
                                                {d.label}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Quick Recommendations */}
                    <Grid item xs={12} md={7}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Stack direction='row' alignItems='center' justifyContent='space-between' mb={3}>
                                    <Typography variant='h6' fontWeight={600}>
                                        <AutoAwesomeIcon sx={{ fontSize: 18, mr: 1, color: 'primary.main', verticalAlign: 'middle' }} />
                                        Recommended For You
                                    </Typography>
                                    <Button
                                        size='small' endIcon={<ArrowForwardIcon />}
                                        onClick={() => navigate('/recommendations')}
                                    >
                                        View All
                                    </Button>
                                </Stack>

                                <Stack spacing={1.5}>
                                    {recsLoading
                                        ? Array(5).fill(0).map((_, i) => (
                                            <Skeleton key={i} variant='rounded' height={64} sx={{ borderRadius: 2 }} />
                                        ))
                                        : recs.slice(0, 5).map((rec, i) => (
                                            <Box
                                                key={rec.problem_id || i}
                                                onClick={() => navigate(`/problems/${rec.slug}`)}
                                                sx={{
                                                    p: 1.5, borderRadius: 2,
                                                    border: '1px solid #2d2d2d',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    '&:hover': {
                                                        borderColor: 'primary.main',
                                                        bgcolor: 'rgba(99,102,241,0.04)'
                                                    },
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Avatar sx={{
                                                    width: 32, height: 32,
                                                    bgcolor: 'rgba(99,102,241,0.15)',
                                                    color: 'primary.main',
                                                    fontSize: '0.8rem', fontWeight: 700
                                                }}>
                                                    {i + 1}
                                                </Avatar>
                                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                    <Typography
                                                        variant='body2' fontWeight={600}
                                                        noWrap sx={{ mb: 0.5 }}
                                                    >
                                                        {rec.title}
                                                    </Typography>
                                                    <Stack direction='row' spacing={0.5}>
                                                        <Chip
                                                            label={rec.difficulty}
                                                            size='small'
                                                            sx={{
                                                                height: 18, fontSize: '0.65rem',
                                                                color: DIFF_COLORS[rec.difficulty],
                                                                bgcolor: `${DIFF_COLORS[rec.difficulty]}15`
                                                            }}
                                                        />
                                                        {rec.topics?.slice(0, 2).map(t => (
                                                            <Chip
                                                                key={t} label={t} size='small'
                                                                variant='outlined'
                                                                sx={{
                                                                    height: 18, fontSize: '0.65rem',
                                                                    borderColor: '#2d2d2d',
                                                                    color: 'text.secondary'
                                                                }}
                                                            />
                                                        ))}
                                                    </Stack>
                                                </Box>
                                                <Typography variant='caption' color='primary.main' fontWeight={700}>
                                                    {Math.round((rec.score || 0) * 100)}%
                                                </Typography>
                                            </Box>
                                        ))
                                    }
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Recent Solves */}
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Stack direction='row' alignItems='center' justifyContent='space-between' mb={2}>
                                    <Typography variant='h6' fontWeight={600}>Recent Solves</Typography>
                                    <Button size='small' endIcon={<ArrowForwardIcon />}
                                        onClick={() => navigate('/profile')}>
                                        View History
                                    </Button>
                                </Stack>
                                {loading
                                    ? <Skeleton variant='rounded' height={120} />
                                    : dashboard?.recentSolves?.length > 0
                                        ? (
                                            <Stack spacing={1}>
                                                {dashboard.recentSolves.map((s, i) => (
                                                    <Stack
                                                        key={i} direction='row'
                                                        alignItems='center' spacing={2}
                                                        sx={{ py: 1, borderBottom: '1px solid #2d2d2d' }}
                                                    >
                                                        <Chip
                                                            label={s.difficulty}
                                                            size='small'
                                                            sx={{
                                                                color: DIFF_COLORS[s.difficulty],
                                                                bgcolor: `${DIFF_COLORS[s.difficulty]}15`,
                                                                minWidth: 64
                                                            }}
                                                        />
                                                        <Typography variant='body2' fontWeight={500} sx={{ flexGrow: 1 }}>
                                                            {s.title}
                                                        </Typography>
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {fmtTime(s.timeTaken)}
                                                        </Typography>
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        )
                                        : (
                                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                                <Typography color='text.secondary' mb={2}>
                                                    No solves yet — start practicing!
                                                </Typography>
                                                <Button variant='contained' onClick={() => navigate('/problems')}>
                                                    Browse Problems
                                                </Button>
                                            </Box>
                                        )
                                }
                            </CardContent>
                        </Card>
                    </Grid>

                </Grid>
            </Container>
        </Box>
    )
}

// src/pages/ProblemsPage.jsx  — saved separately
// src/pages/ProblemDetail.jsx — saved separately
// src/pages/RecsPage.jsx      — saved separately
// src/pages/ProfilePage.jsx   — saved separately