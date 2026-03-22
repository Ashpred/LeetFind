import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box, Container, Typography, Card, CardContent, Stack,
    Chip, Button, Grid, TextField, Dialog, DialogTitle,
    DialogContent, DialogActions, Alert, Skeleton
} from '@mui/material'
import ArrowBackIcon    from '@mui/icons-material/ArrowBack'
import CheckCircleIcon  from '@mui/icons-material/CheckCircle'
import OpenInNewIcon    from '@mui/icons-material/OpenInNew'
import AutoAwesomeIcon  from '@mui/icons-material/AutoAwesome'
import { problemsAPI, solvesAPI } from '../services/api'

import { fetchSolvedIds } from '../store/slices/userSlice'
import { useDispatch } from 'react-redux'

const DIFF_COLORS = { Easy: '#4ade80', Medium: '#f59e0b', Hard: '#f87171' }

export default function ProblemDetail() {
    const { slug }     = useParams()
    const navigate     = useNavigate()
    const dispatch = useDispatch()
    const [problem,  setProblem]  = useState(null)
    const [similar,  setSimilar]  = useState([])
    const [solved,   setSolved]   = useState(false)
    const [loading,  setLoading]  = useState(true)
    const [open,     setOpen]     = useState(false)
    const [form,     setForm]     = useState({ timeTaken: '', attempts: 1 })
    const [success,  setSuccess]  = useState(false)
    const [error,    setError]    = useState(null)

    useEffect(() => {
        setLoading(true)
        Promise.all([
            problemsAPI.getBySlug(slug),
            problemsAPI.getSimilar(slug, 4)
        ]).then(([probRes, simRes]) => {
            setProblem(probRes.data.data.problem)
            setSimilar(simRes.data.data.similarProblems || [])
            // Check if already solved
            return solvesAPI.check(probRes.data.data.problem.problemId)
        }).then(res => {
            setSolved(res.data.data.solved)
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [slug])

    const handleMarkSolved = async () => {
        try {
            setError(null)
            await solvesAPI.log({
                problemId:  problem.problemId,
                slug:       problem.slug,
                title:      problem.title,
                difficulty: problem.difficulty,
                topics:     problem.topics,
                timeTaken:  parseInt(form.timeTaken) || 0,
                attempts:   parseInt(form.attempts)  || 1,
            })
            setSolved(true)
            setSuccess(true)
            setOpen(false)

            dispatch(fetchSolvedIds())

        } catch (err) {
            setError(err.response?.data?.message || 'Failed to log solve')
        }
    }

    if (loading) return (
        <Container maxWidth='lg' sx={{ py: 4 }}>
            <Skeleton variant='rounded' height={300} sx={{ borderRadius: 3 }} />
        </Container>
    )

    if (!problem) return (
        <Container maxWidth='lg' sx={{ py: 4 }}>
            <Typography>Problem not found</Typography>
        </Container>
    )

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
            <Container maxWidth='lg'>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/problems')} sx={{ mb: 3 }}>
                    Back to Problems
                </Button>

                <Grid container spacing={3}>
                    {/* Main problem info */}
                    <Grid item xs={12} md={8}>
                        <Card>
                            <CardContent>
                                <Stack direction='row' alignItems='flex-start' justifyContent='space-between' mb={2}>
                                    <Box sx={{ flexGrow: 1, mr: 2 }}>
                                        <Typography variant='h5' fontWeight={700} mb={1}>
                                            #{problem.problemId} {problem.title}
                                        </Typography>
                                        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                                            <Chip
                                                label={problem.difficulty} size='small'
                                                sx={{
                                                    color: DIFF_COLORS[problem.difficulty],
                                                    bgcolor: `${DIFF_COLORS[problem.difficulty]}15`,
                                                    border: `1px solid ${DIFF_COLORS[problem.difficulty]}30`,
                                                    fontWeight: 600
                                                }}
                                            />
                                            {problem.topics.map(t => (
                                                <Chip key={t} label={t} size='small' variant='outlined'
                                                    sx={{ borderColor: '#2d2d2d', color: 'text.secondary' }} />
                                            ))}
                                        </Stack>
                                    </Box>
                                    {solved && (
                                        <Chip
                                            icon={<CheckCircleIcon />} label='Solved'
                                            sx={{ bgcolor: '#4ade8020', color: '#4ade80',
                                                border: '1px solid #4ade8040' }}
                                        />
                                    )}
                                </Stack>

                                <Stack direction='row' spacing={3} sx={{ py: 2, borderTop: '1px solid #2d2d2d', borderBottom: '1px solid #2d2d2d', my: 2 }}>
                                    <Box>
                                        <Typography variant='caption' color='text.secondary'>Acceptance</Typography>
                                        <Typography fontWeight={600}>
                                            {(problem.acceptance * 100).toFixed(1)}%
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant='caption' color='text.secondary'>Difficulty</Typography>
                                        <Typography fontWeight={600} sx={{ color: DIFF_COLORS[problem.difficulty] }}>
                                            {problem.difficulty}
                                        </Typography>
                                    </Box>
                                </Stack>

                                {success && (
                                    <Alert severity='success' sx={{ mb: 2, borderRadius: 2 }}>
                                        Solve logged successfully! Your recommendations will update.
                                    </Alert>
                                )}

                                <Stack direction='row' spacing={2} mt={2}>
                                    <Button
                                        variant='contained'
                                        onClick={() => setOpen(true)}
                                        disabled={solved}
                                        startIcon={solved ? <CheckCircleIcon /> : null}
                                    >
                                        {solved ? 'Already Solved' : 'Mark as Solved'}
                                    </Button>
                                    <Button
                                        variant='outlined'
                                        endIcon={<OpenInNewIcon />}
                                        onClick={() => window.open(problem.url, '_blank')}
                                    >
                                        Open on LeetCode
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Similar problems */}
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography variant='h6' fontWeight={600} mb={2}>
                                    <AutoAwesomeIcon sx={{ fontSize: 18, mr: 1, color: 'primary.main', verticalAlign: 'middle' }} />
                                    Similar Problems
                                </Typography>
                                <Stack spacing={1.5}>
                                    {similar.map((s, i) => (
                                        <Box
                                            key={i}
                                            onClick={() => navigate(`/problems/${s.slug || s.titleSlug}`)}
                                            sx={{
                                                p: 1.5, borderRadius: 2, border: '1px solid #2d2d2d',
                                                cursor: 'pointer',
                                                '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(99,102,241,0.04)' },
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Typography variant='body2' fontWeight={600} mb={0.5} noWrap>
                                                {s.title}
                                            </Typography>
                                            <Stack direction='row' spacing={1} alignItems='center'>
                                                <Chip label={s.difficulty} size='small'
                                                    sx={{ color: DIFF_COLORS[s.difficulty],
                                                        bgcolor: `${DIFF_COLORS[s.difficulty]}15`,
                                                        fontSize: '0.65rem', height: 18 }} />
                                                <Typography variant='caption' color='text.secondary'>
                                                    {Math.round((s.similarity || 0) * 100)}% similar
                                                </Typography>
                                            </Stack>
                                        </Box>
                                    ))}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Mark Solved Dialog */}
                <Dialog open={open} onClose={() => setOpen(false)} maxWidth='xs' fullWidth
                    PaperProps={{ sx: { bgcolor: 'background.paper', backgroundImage: 'none' } }}>
                    <DialogTitle fontWeight={600}>Log Your Solve</DialogTitle>
                    <DialogContent>
                        {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
                        <Stack spacing={2.5} sx={{ mt: 1 }}>
                            <TextField
                                fullWidth label='Time Taken (seconds)' type='number'
                                value={form.timeTaken}
                                onChange={e => setForm(f => ({ ...f, timeTaken: e.target.value }))}
                                helperText='How long did it take? (optional)'
                                size='small'
                            />
                            <TextField
                                fullWidth label='Number of Attempts' type='number'
                                value={form.attempts}
                                onChange={e => setForm(f => ({ ...f, attempts: e.target.value }))}
                                inputProps={{ min: 1 }}
                                size='small'
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 3 }}>
                        <Button onClick={() => setOpen(false)} variant='outlined'>Cancel</Button>
                        <Button onClick={handleMarkSolved} variant='contained'>Confirm Solve</Button>
                    </DialogActions>
                </Dialog>

            </Container>
        </Box>
    )
}