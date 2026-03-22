// src/pages/HomePage.jsx
import { useNavigate } from 'react-router-dom'
import { useSelector }  from 'react-redux'
import {
    Box, Container, Typography, Button, Grid,
    Card, CardContent, Chip, Stack, Avatar
} from '@mui/material'
import AutoAwesomeIcon   from '@mui/icons-material/AutoAwesome'
import PsychologyIcon    from '@mui/icons-material/Psychology'
import TrendingUpIcon    from '@mui/icons-material/TrendingUp'
import CodeIcon          from '@mui/icons-material/Code'
import BarChartIcon      from '@mui/icons-material/BarChart'
import EmojiEventsIcon   from '@mui/icons-material/EmojiEvents'

const FEATURES = [
    {
        icon:  <AutoAwesomeIcon sx={{ fontSize: 32, color: '#6366f1' }} />,
        title: 'Hybrid AI Recommendations',
        desc:  'Combines collaborative filtering, content similarity and weak area detection to surface the most relevant problems for you.'
    },
    {
        icon:  <PsychologyIcon sx={{ fontSize: 32, color: '#f59e0b' }} />,
        title: 'Weak Area Detection',
        desc:  'Our ML model identifies your skill gaps across 20 topic areas and prioritizes problems that will improve you fastest.'
    },
    {
        icon:  <TrendingUpIcon sx={{ fontSize: 32, color: '#4ade80' }} />,
        title: 'Skill Progression Tracking',
        desc:  'Visualize your mastery across topics with a radar chart that updates every time you solve a new problem.'
    },
    {
        icon:  <BarChartIcon sx={{ fontSize: 32, color: '#f87171' }} />,
        title: 'Detailed Analytics',
        desc:  'Track solve times, attempt counts, streaks and difficulty distribution across your entire solve history.'
    },
]

const STATS = [
    { value: '2,500+', label: 'Problems' },
    { value: '20',     label: 'Topics' },
    { value: '3',      label: 'ML Models' },
    { value: '< 1s',   label: 'Rec Speed' },
]

const DIFFICULTY_COLORS = {
    Easy:   '#4ade80',
    Medium: '#f59e0b',
    Hard:   '#f87171'
}

const SAMPLE_RECS = [
    { title: 'Longest Increasing Subsequence', difficulty: 'Medium', topics: ['Dynamic Programming', 'Binary Search'], score: 0.89 },
    { title: 'Word Break II',                  difficulty: 'Hard',   topics: ['Dynamic Programming', 'Backtracking'],  score: 0.85 },
    { title: 'Sliding Window Maximum',         difficulty: 'Hard',   topics: ['Array', 'Sliding Window', 'Heap'],      score: 0.82 },
]

export default function HomePage() {
    const navigate      = useNavigate()
    const { token }     = useSelector(state => state.auth)

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>

            {/* ── Hero ──────────────────────────────────────────────────── */}
            <Box sx={{
                pt: { xs: 8, md: 14 },
                pb: { xs: 8, md: 12 },
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-30%', left: '50%',
                    transform: 'translateX(-50%)',
                    width: '800px', height: '800px',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                    pointerEvents: 'none'
                }
            }}>
                <Container maxWidth='md'>
                    {/* <Chip
                        icon={<AutoAwesomeIcon sx={{ fontSize: '16px !important' }} />}
                        label='Powered by Hybrid ML — CF + Content + Weak Area Detection'
                        sx={{
                            mb: 3, bgcolor: 'rgba(99,102,241,0.12)',
                            color: 'primary.light', border: '1px solid rgba(99,102,241,0.3)',
                            fontWeight: 500
                        }}
                    /> */}
                    <Typography variant='h2' component='h1' sx={{
                        fontSize: { xs: '2.5rem', md: '4rem' },
                        fontWeight: 800,
                        lineHeight: 1.1,
                        mb: 3,
                        background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        The Smartest Way to<br />
                        <Box component='span' sx={{
                            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Practice LeetCode
                        </Box>
                    </Typography>
                    <Typography variant='h6' color='text.secondary' sx={{
                        mb: 5, fontWeight: 400, maxWidth: 560, mx: 'auto', lineHeight: 1.7
                    }}>
                        Stop grinding randomly. <br/> Get Personalised Problem Recommendations based on what you should practice.
                    </Typography>
                    <Stack direction='row' spacing={2} justifyContent='center'>
                        <Button
                            variant='contained'
                            size='large'
                            onClick={() => navigate(token ? '/dashboard' : '/register')}
                            sx={{ px: 4, py: 1.5, fontSize: '1rem' }}
                        >
                            {token ? 'Go to Dashboard' : 'Get Started Free'}
                        </Button>
                        <Button
                            variant='outlined'
                            size='large'
                            onClick={() => navigate('/problems')}
                            sx={{ px: 4, py: 1.5, fontSize: '1rem' }}
                        >
                            Browse Problems
                        </Button>
                    </Stack>
                </Container>
            </Box>

            {/* ── Stats bar ─────────────────────────────────────────────── */}
            <Box sx={{ borderTop: '1px solid #2d2d2d', borderBottom: '1px solid #2d2d2d', py: 4 }}>
                <Container maxWidth='md'>
                    <Grid container spacing={2} justifyContent='center'>
                        {STATS.map(s => (
                            <Grid item xs={6} sm={3} key={s.label} sx={{ textAlign: 'center' }}>
                                <Typography variant='h4' fontWeight={800} color='primary.main'>
                                    {s.value}
                                </Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    {s.label}
                                </Typography>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* ── Features ──────────────────────────────────────────────── */}
            <Container maxWidth='lg' sx={{ py: { xs: 8, md: 12 } }}>
                <Typography variant='h4' fontWeight={700} textAlign='center' mb={1}>
                    Everything you need to improve faster
                </Typography>
                <Typography color='text.secondary' textAlign='center' mb={6}>
                    Built with a hybrid ML pipeline trained on thousands of user interactions
                </Typography>
                <Grid container spacing={3}>
                    {FEATURES.map(f => (
                        <Grid item xs={12} sm={6} key={f.title}>
                            <Card sx={{ height: '100%', p: 1 }}>
                                <CardContent>
                                    <Box sx={{
                                        width: 56, height: 56, borderRadius: 2,
                                        bgcolor: 'rgba(255,255,255,0.04)',
                                        display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', mb: 2
                                    }}>
                                        {f.icon}
                                    </Box>
                                    <Typography variant='h6' fontWeight={600} mb={1}>
                                        {f.title}
                                    </Typography>
                                    <Typography variant='body2' color='text.secondary' lineHeight={1.7}>
                                        {f.desc}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            {/* ── Sample recommendations preview ────────────────────────── */}
            <Box sx={{ bgcolor: 'rgba(99,102,241,0.04)', borderTop: '1px solid #2d2d2d', py: { xs: 8, md: 12 } }}>
                <Container maxWidth='md'>
                    <Typography variant='h4' fontWeight={700} textAlign='center' mb={1}>
                        Recommendations that make sense
                    </Typography>
                    <Typography color='text.secondary' textAlign='center' mb={6}>
                        Every suggestion comes with a score breakdown so you know exactly why it was recommended
                    </Typography>
                    <Stack spacing={2}>
                        {SAMPLE_RECS.map((rec, i) => (
                            <Card key={i} sx={{ p: 0.5 }}>
                                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Avatar sx={{
                                        bgcolor: 'rgba(99,102,241,0.15)',
                                        color: 'primary.main',
                                        fontWeight: 700, fontSize: '0.9rem'
                                    }}>
                                        #{i + 1}
                                    </Avatar>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography fontWeight={600} mb={0.5}>{rec.title}</Typography>
                                        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                                            <Chip
                                                label={rec.difficulty}
                                                size='small'
                                                sx={{
                                                    color: DIFFICULTY_COLORS[rec.difficulty],
                                                    bgcolor: `${DIFFICULTY_COLORS[rec.difficulty]}15`,
                                                    border: `1px solid ${DIFFICULTY_COLORS[rec.difficulty]}30`
                                                }}
                                            />
                                            {rec.topics.map(t => (
                                                <Chip key={t} label={t} size='small' variant='outlined'
                                                    sx={{ borderColor: '#2d2d2d', color: 'text.secondary' }} />
                                            ))}
                                        </Stack>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant='h6' fontWeight={700} color='primary.main'>
                                            {Math.round(rec.score * 100)}%
                                        </Typography>
                                        <Typography variant='caption' color='text.secondary'>
                                            match score
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                    <Box textAlign='center' mt={4}>
                        <Button
                            variant='contained'
                            size='large'
                            onClick={() => navigate(token ? '/recommendations' : '/register')}
                            startIcon={<AutoAwesomeIcon />}
                        >
                            {token ? 'View My Recommendations' : 'Get Your Recommendations'}
                        </Button>
                    </Box>
                </Container>
            </Box>

            {/* ── CTA ───────────────────────────────────────────────────── */}
            <Box sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
                <Container maxWidth='sm'>
                    <EmojiEventsIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
                    <Typography variant='h4' fontWeight={700} mb={2}>
                        Ready to level up?
                    </Typography>
                    <Typography color='text.secondary' mb={4}>
                        Join and start getting personalized recommendations today.
                    </Typography>
                    {!token && (
                        <Button
                            variant='contained'
                            size='large'
                            onClick={() => navigate('/register')}
                            sx={{ px: 5 }}
                        >
                            Create Free Account
                        </Button>
                    )}
                </Container>
            </Box>

        </Box>
    )
}
