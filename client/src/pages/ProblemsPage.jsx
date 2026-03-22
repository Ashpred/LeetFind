import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box, Container, Typography, Stack, Chip, TextField,
    Select, MenuItem, FormControl, InputLabel, InputAdornment,
    Button, Pagination, Skeleton, ToggleButton, ToggleButtonGroup,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material'
import SearchIcon      from '@mui/icons-material/Search'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { fetchProblems, fetchTopics } from '../store/slices/problemSlice'
import { solvesAPI } from '../services/api'
import { fetchSolvedIds } from '../store/slices/userSlice'

const DIFF_COLORS = { Easy: '#4ade80', Medium: '#f59e0b', Hard: '#f87171' }

export default function ProblemsPage() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { items, topics, pagination, loading } = useSelector(state => state.problems)
   

    const [filters, setFilters] = useState({
    search: '', difficulty: '', topic: '', page: 1, limit: 50, sort: 'acceptance'
    })

    const solvedIdsArr = useSelector(state => state.user.solvedIds)
    const solvedIds    = new Set(solvedIdsArr)

    useEffect(() => {
        dispatch(fetchTopics())
        dispatch(fetchSolvedIds())
    }, [dispatch])

    useEffect(() => {
        const params = {}
        if (filters.search)     params.search     = filters.search
        if (filters.difficulty) params.difficulty  = filters.difficulty
        if (filters.topic)      params.topic       = filters.topic
        params.page  = filters.page
        params.limit = filters.limit
        params.sort  = filters.sort
        dispatch(fetchProblems(params))
    }, [filters, dispatch])

    const handleFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }))

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
            <Container maxWidth='xl'>

                {/* Header */}
                <Box mb={3}>
                    <Typography variant='h4' fontWeight={700} mb={0.5}>Problems</Typography>
                    <Typography color='text.secondary'>
                        {pagination?.total?.toLocaleString()} problems
                    </Typography>
                </Box>

                {/* Filters */}
                <Stack direction='row' spacing={2} mb={3} flexWrap='wrap' useFlexGap alignItems='center'>
                    <TextField
                        size='small' placeholder='Search problems...'
                        value={filters.search}
                        onChange={e => handleFilter('search', e.target.value)}
                        sx={{ minWidth: 260 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position='start'>
                                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                                </InputAdornment>
                            )
                        }}
                    />
                    <FormControl size='small' sx={{ minWidth: 120 }}>
                        <InputLabel>Difficulty</InputLabel>
                        <Select value={filters.difficulty} label='Difficulty'
                            onChange={e => handleFilter('difficulty', e.target.value)}>
                            <MenuItem value=''>All</MenuItem>
                            <MenuItem value='Easy'>Easy</MenuItem>
                            <MenuItem value='Medium'>Medium</MenuItem>
                            <MenuItem value='Hard'>Hard</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size='small' sx={{ minWidth: 180 }}>
                        <InputLabel>Topic</InputLabel>
                        <Select value={filters.topic} label='Topic'
                            onChange={e => handleFilter('topic', e.target.value)}>
                            <MenuItem value=''>All Topics</MenuItem>
                            {topics.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <ToggleButtonGroup
                        value={filters.sort} exclusive size='small'
                        onChange={(_, v) => v && handleFilter('sort', v)}
                        sx={{ '& .MuiToggleButton-root': { px: 2, fontSize: '0.75rem', py: 0.7 } }}
                    >
                        <ToggleButton value='problemId'>ID</ToggleButton>
                        <ToggleButton value='acceptance'>Acceptance</ToggleButton>
                        <ToggleButton value='difficulty'>Difficulty</ToggleButton>
                    </ToggleButtonGroup>
                    {(filters.difficulty || filters.topic || filters.search) && (
                        <Button size='small' variant='outlined'
                            onClick={() => setFilters(f => ({ ...f, difficulty: '', topic: '', search: '', page: 1 }))}>
                            Clear
                        </Button>
                    )}
                </Stack>

                {/* Table */}
                <TableContainer component={Paper} sx={{
                    bgcolor: 'background.paper',
                    border: '1px solid #2d2d2d',
                    borderRadius: 3, mb: 3
                }}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ '& th': { borderColor: '#2d2d2d', py: 1.5, bgcolor: 'rgba(255,255,255,0.02)' } }}>
                                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, width: 50 }} />
                                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, width: 70 }}>#</TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Title</TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, width: 500 }}>Topics</TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, width: 200 }}>Difficulty</TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, width: 200 }}>Acceptance</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading
                                ? Array(20).fill(0).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={6} sx={{ borderColor: '#2d2d2d' }}>
                                            <Skeleton variant='text' height={44} />
                                        </TableCell>
                                    </TableRow>
                                ))
                                : items.map(problem => {
                                    const isSolved = solvedIds.has(problem.problemId)
                                    return (
                                        <TableRow
                                            key={problem._id}
                                            onClick={() => navigate(`/problems/${problem.slug}`)}
                                            sx={{
                                                cursor: 'pointer',
                                                '& td': { borderColor: '#2d2d2d', py: 1.4 },
                                                '&:hover': { bgcolor: 'rgba(99,102,241,0.05)' },
                                                '&:last-child td': { border: 0 }
                                            }}
                                        >
                                            <TableCell>
                                                {isSolved && (
                                                    <CheckCircleIcon sx={{ color: '#4ade80', fontSize: 18, display: 'block' }} />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant='body2' color='text.secondary'>
                                                    {problem.problemId}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant='body2' fontWeight={500}
                                                    sx={{ color: isSolved ? '#4ade80' : 'text.primary' }}>
                                                    {problem.title}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap>
                                                    {problem.topics.slice(0, 3).map(t => (
                                                        <Chip key={t} label={t} size='small' variant='outlined'
                                                            sx={{ borderColor: '#2d2d2d', color: 'text.secondary',
                                                                fontSize: '0.68rem', height: 20 }} />
                                                    ))}
                                                    {problem.topics.length > 3 && (
                                                        <Chip label={`+${problem.topics.length - 3}`} size='small'
                                                            sx={{ color: 'text.secondary', bgcolor: '#2d2d2d',
                                                                fontSize: '0.68rem', height: 20 }} />
                                                    )}
                                                </Stack>
                                            </TableCell>
                                            <TableCell alignItems='center'>
                                                <Chip label={problem.difficulty} size='small'
                                                    sx={{
                                                        color: DIFF_COLORS[problem.difficulty],
                                                        bgcolor: `${DIFF_COLORS[problem.difficulty]}15`,
                                                        fontWeight: 600, fontSize: '0.72rem'
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant='body2' color='text.secondary'>
                                                    {problem.acceptance.toFixed(1)}%
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            }
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Pagination */}
                {pagination && (
                    <Stack direction='row' justifyContent='space-between' alignItems='center'>
                        <Typography variant='caption' color='text.secondary'>
                            Showing {((filters.page - 1) * filters.limit) + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total.toLocaleString()}
                        </Typography>
                        <Pagination
                            count={pagination.totalPages}
                            page={filters.page}
                            onChange={(_, p) => setFilters(f => ({ ...f, page: p }))}
                            color='primary' shape='rounded' size='small'
                        />
                    </Stack>
                )}

            </Container>
        </Box>
    )
}