import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box, Container, Typography, Grid, Card, CardContent,
    Stack, Chip, Button, Select, MenuItem, FormControl,
    InputLabel, LinearProgress, Skeleton, Alert, Tooltip
} from '@mui/material'
import AutoAwesomeIcon  from '@mui/icons-material/AutoAwesome'
import RefreshIcon      from '@mui/icons-material/Refresh'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { fetchRecommendations } from '../store/slices/recsSlice'

const DIFF_COLORS = { Easy: '#4ade80', Medium: '#f59e0b', Hard: '#f87171' }
const SCORE_LABELS = {
    cf_score:   { label: 'Collaborative', color: '#6366f1', tip: 'Based on similar users solve patterns' },
    cb_score:   { label: 'Content',       color: '#f59e0b', tip: 'Based on problem similarity to your history' },
    wa_score:   { label: 'Weak Area',     color: '#f87171', tip: 'Based on your topic knowledge gaps' },
    diff_score: { label: 'Difficulty Fit',color: '#4ade80', tip: 'How well difficulty matches your level' },
}

function ScoreBar({ label, value, color, tip }) {
    return (
        <Tooltip title={tip} placement='top'>
            <Box sx={{ cursor: 'help' }}>
                <Stack direction='row' justifyContent='space-between' mb={0.3}>
                    <Typography variant='caption' color='text.secondary'>{label}</Typography>
                    <Typography variant='caption' fontWeight={600} sx={{ color }}>
                        {Math.round((value || 0) * 100)}%
                    </Typography>
                </Stack>
                <LinearProgress variant='determinate' value={(value || 0) * 100}
                    sx={{ height: 4, borderRadius: 2, bgcolor: '#2d2d2d',
                        '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 } }} />
            </Box>
        </Tooltip>
    )
}

function RecCard({ rec, rank }) {
    const navigate = useNavigate()
    return (
        <Card sx={{ '&:hover': { transform: 'translateY(-2px)', borderColor: 'primary.main' },
            transition: 'all 0.2s', cursor: 'pointer' }}
            onClick={() => navigate(`/problems/${rec.slug}`)}>
            <CardContent>
                <Stack direction='row' alignItems='flex-start' spacing={2} mb={2}>
                    <Box sx={{ minWidth: 36, height: 36, borderRadius: 1.5,
                        bgcolor: 'rgba(99,102,241,0.15)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant='body2' fontWeight={700} color='primary.main'>#{rank}</Typography>
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography fontWeight={600} noWrap mb={0.5}>{rec.title}</Typography>
                        <Stack direction='row' spacing={0.8} flexWrap='wrap' useFlexGap>
                            <Chip label={rec.difficulty} size='small'
                                sx={{ color: DIFF_COLORS[rec.difficulty],
                                    bgcolor: `${DIFF_COLORS[rec.difficulty]}15`,
                                    fontWeight: 600, fontSize: '0.7rem' }} />
                            {rec.topics?.slice(0, 2).map(t => (
                                <Chip key={t} label={t} size='small' variant='outlined'
                                    sx={{ borderColor: '#2d2d2d', color: 'text.secondary', fontSize: '0.7rem' }} />
                            ))}
                        </Stack>
                    </Box>
                    <Box textAlign='right'>
                        <Typography variant='h6' fontWeight={800} color='primary.main'>
                            {Math.round((rec.score || 0) * 100)}%
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>match</Typography>
                    </Box>
                </Stack>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, p: 1.5, border: '1px solid #2d2d2d' }}>
                    <Stack direction='row' alignItems='center' spacing={0.5} mb={1}>
                        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                        <Typography variant='caption' color='text.secondary'>Why recommended</Typography>
                    </Stack>
                    <Stack spacing={1}>
                        {Object.entries(SCORE_LABELS).map(([key, meta]) => (
                            <ScoreBar key={key} label={meta.label} value={rec[key] || 0} color={meta.color} tip={meta.tip} />
                        ))}
                    </Stack>
                </Box>
                <Button variant='outlined' size='small' fullWidth endIcon={<ArrowForwardIcon />} sx={{ mt: 2 }}
                    onClick={e => { e.stopPropagation(); navigate(`/problems/${rec.slug}`) }}>
                    View Problem
                </Button>
            </CardContent>
        </Card>
    )
}

export default function RecsPage() {
    const dispatch = useDispatch()
    const { items, loading, cached, error } = useSelector(state => state.recs)
    const [difficulty, setDifficulty] = useState('')

    const load = () => {
        const params = { n: 20 }
        if (difficulty) params.difficulty = difficulty
        dispatch(fetchRecommendations(params))
    }

    useEffect(() => { load() }, [dispatch])

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
            <Container maxWidth='xl'>
                <Stack direction='row' alignItems='flex-start' justifyContent='space-between' mb={4} flexWrap='wrap' gap={2}>
                    <Box>
                        <Typography variant='h4' fontWeight={700} mb={0.5}>
                            <AutoAwesomeIcon sx={{ mr: 1, color: 'primary.main', verticalAlign: 'middle' }} />
                            Your Recommendations
                        </Typography>
                        <Typography color='text.secondary'>
                            Powered by hybrid ML — personalized to your skill level and gaps
                            {cached && <Chip label='Cached' size='small' sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />}
                        </Typography>
                    </Box>
                    <Button variant='outlined' startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Refresh</Button>
                </Stack>
                <Stack direction='row' spacing={2} mb={4}>
                    <FormControl size='small' sx={{ minWidth: 140 }}>
                        <InputLabel>Difficulty</InputLabel>
                        <Select value={difficulty} label='Difficulty' onChange={e => setDifficulty(e.target.value)}>
                            <MenuItem value=''>All</MenuItem>
                            <MenuItem value='Easy'>Easy</MenuItem>
                            <MenuItem value='Medium'>Medium</MenuItem>
                            <MenuItem value='Hard'>Hard</MenuItem>
                        </Select>
                    </FormControl>
                    <Button variant='contained' size='small' onClick={load}>Apply</Button>
                </Stack>
                {error && <Alert severity='error' sx={{ mb: 3 }}>Failed to load recommendations — make sure the ML service is running</Alert>}
                <Grid container spacing={3}>
                    {loading
                        ? Array(8).fill(0).map((_, i) => (
                            <Grid item xs={12} sm={6} lg={4} xl={3} key={i}>
                                <Skeleton variant='rounded' height={280} sx={{ borderRadius: 3 }} />
                            </Grid>
                        ))
                        : items.map((rec, i) => (
                            <Grid item xs={12} sm={6} lg={4} xl={3} key={rec.problem_id || i}>
                                <RecCard rec={rec} rank={i + 1} />
                            </Grid>
                        ))
                    }
                </Grid>
            </Container>
        </Box>
    )
}