import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box, Container, Typography, Grid, Card, CardContent,
    Stack, Chip, Avatar, Divider, Skeleton
} from '@mui/material'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import WhatshotIcon    from '@mui/icons-material/Whatshot'
import TimerIcon       from '@mui/icons-material/Timer'
import { fetchProfile } from '../store/slices/userSlice'
import { solvesAPI }    from '../services/api'
import { useState }     from 'react'

const DIFF_COLORS = { Easy: '#4ade80', Medium: '#f59e0b', Hard: '#f87171' }

const fmtTime = secs => {
    if (!secs) return '—'
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function ProfilePage() {
    const dispatch = useDispatch()
    const { user }    = useSelector(state => state.auth)
    const { profile } = useSelector(state => state.user)
    const [solves, setSolves]     = useState([])
    const [loading, setLoading]   = useState(true)

    useEffect(() => {
        dispatch(fetchProfile())
        solvesAPI.getHistory({ limit: 50 }).then(res => {
            setSolves(res.data.data.solves || [])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [dispatch])

    const stats = profile?.stats || {}

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
            <Container maxWidth='lg'>

                {/* Profile header */}
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Stack direction='row' spacing={3} alignItems='center'>
                            <Avatar sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: '1.8rem', fontWeight: 700 }}>
                                {user?.username?.[0]?.toUpperCase()}
                            </Avatar>
                            <Box>
                                <Typography variant='h5' fontWeight={700}>{user?.username}</Typography>
                                <Typography color='text.secondary'>{user?.email}</Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                <Grid container spacing={3}>
                    {/* Stats */}
                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant='h6' fontWeight={600} mb={2}>Statistics</Typography>
                                <Stack spacing={2}>
                                    {[
                                        { icon: <EmojiEventsIcon sx={{ color: '#6366f1' }} />, label: 'Total Solved',   value: stats.totalSolved  || 0 },
                                        { icon: <WhatshotIcon    sx={{ color: '#f59e0b' }} />, label: 'Current Streak', value: `${stats.streak || 0} days` },
                                        { icon: <TimerIcon       sx={{ color: '#4ade80' }} />, label: 'Total Time',     value: fmtTime(stats.totalTime || 0) },
                                    ].map(s => (
                                        <Stack key={s.label} direction='row' alignItems='center' spacing={2}>
                                            {s.icon}
                                            <Box>
                                                <Typography variant='body2' color='text.secondary'>{s.label}</Typography>
                                                <Typography fontWeight={600}>{s.value}</Typography>
                                            </Box>
                                        </Stack>
                                    ))}
                                    <Divider sx={{ borderColor: '#2d2d2d' }} />
                                    {[
                                        { label: 'Easy',   count: stats.easySolved   || 0, color: '#4ade80' },
                                        { label: 'Medium', count: stats.mediumSolved || 0, color: '#f59e0b' },
                                        { label: 'Hard',   count: stats.hardSolved   || 0, color: '#f87171' },
                                    ].map(d => (
                                        <Stack key={d.label} direction='row' justifyContent='space-between' alignItems='center'>
                                            <Chip label={d.label} size='small'
                                                sx={{ color: d.color, bgcolor: `${d.color}15`, fontWeight: 600 }} />
                                            <Typography fontWeight={700} sx={{ color: d.color }}>{d.count}</Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Solve history */}
                    <Grid item xs={12} md={8}>
                        <Card>
                            <CardContent>
                                <Typography variant='h6' fontWeight={600} mb={2}>Solve History</Typography>
                                <Stack spacing={1}>
                                    {loading
                                        ? Array(10).fill(0).map((_, i) => (
                                            <Skeleton key={i} variant='rounded' height={48} sx={{ borderRadius: 2 }} />
                                        ))
                                        : solves.length > 0
                                            ? solves.map((s, i) => (
                                                <Stack key={i} direction='row' alignItems='center' spacing={2}
                                                    sx={{ py: 1.5, px: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)',
                                                        border: '1px solid #2d2d2d' }}>
                                                    <Chip label={s.difficulty} size='small'
                                                        sx={{ color: DIFF_COLORS[s.difficulty],
                                                            bgcolor: `${DIFF_COLORS[s.difficulty]}15`,
                                                            minWidth: 64, fontWeight: 600 }} />
                                                    <Typography variant='body2' fontWeight={500} sx={{ flexGrow: 1 }}>
                                                        {s.title}
                                                    </Typography>
                                                    <Typography variant='caption' color='text.secondary'>
                                                        {fmtTime(s.timeTaken)}
                                                    </Typography>
                                                    <Typography variant='caption' color='text.secondary'>
                                                        {new Date(s.solvedAt).toLocaleDateString()}
                                                    </Typography>
                                                </Stack>
                                            ))
                                            : (
                                                <Box sx={{ textAlign: 'center', py: 6 }}>
                                                    <Typography color='text.secondary'>No solves yet</Typography>
                                                </Box>
                                            )
                                    }
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    )
}