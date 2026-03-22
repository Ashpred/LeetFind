import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box, Container, Typography, TextField, Button,
    Alert, InputAdornment, IconButton, Divider, Stack, LinearProgress
} from '@mui/material'
import PersonIcon        from '@mui/icons-material/Person'
import EmailIcon         from '@mui/icons-material/Email'
import LockIcon          from '@mui/icons-material/Lock'
import VisibilityIcon    from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CodeIcon          from '@mui/icons-material/Code'
import LoginIcon         from '@mui/icons-material/Login'
import { registerUser, clearError } from '../store/slices/authSlice'

// Password strength indicator
const getStrength = pwd => {
    let score = 0
    if (pwd.length >= 8)               score++
    if (/[A-Z]/.test(pwd))             score++
    if (/[a-z]/.test(pwd))             score++
    if (/\d/.test(pwd))                score++
    if (/[^A-Za-z0-9]/.test(pwd))     score++
    return score
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
const STRENGTH_COLORS = ['', '#f87171', '#fb923c', '#f59e0b', '#4ade80', '#34d399']

export default function RegisterPage() {
    const navigate  = useNavigate()
    const dispatch  = useDispatch()
    const { loading, error } = useSelector(state => state.auth)

    const [form, setForm]         = useState({ username: '', email: '', password: '' })
    const [showPass, setShowPass] = useState(false)
    const strength                = getStrength(form.password)

    const handleChange = e => {
        dispatch(clearError())
        setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async e => {
        e.preventDefault()
        const res = await dispatch(registerUser(form))
        if (res.type === 'auth/register/fulfilled') navigate('/dashboard')
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor:   'background.default',
            display:   'flex',
            position:  'relative',
            overflow:  'hidden',
            '&::before': {
                content: '""', position: 'absolute',
                top: '-20%', right: '-10%',
                width: '600px', height: '600px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
                pointerEvents: 'none'
            }
        }}>
            <Container maxWidth='sm' sx={{
                display: 'flex', flexDirection: 'column',
                justifyContent: 'center', py: 8,
                position: 'relative', zIndex: 1
            }}>
                {/* Logo */}
                <Stack direction='row' alignItems='center' spacing={1} mb={6}>
                    <CodeIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                    <Typography variant='h6' fontWeight={700} sx={{
                        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        AlgoRec
                    </Typography>
                </Stack>

                <Typography variant='h4' fontWeight={700} mb={1}>Create your account</Typography>
                <Typography color='text.secondary' mb={4}>
                    Start getting AI-powered problem recommendations today
                </Typography>

                {error && (
                    <Alert severity='error' sx={{ mb: 3, borderRadius: 2 }}>
                        {Array.isArray(error.errors)
                            ? error.errors.map(e => e.message).join(', ')
                            : error.message || 'Registration failed'}
                    </Alert>
                )}

                <Box component='form' onSubmit={handleSubmit}>
                    <Stack spacing={2.5}>
                        <TextField
                            fullWidth label='Username' name='username'
                            value={form.username} onChange={handleChange}
                            required autoComplete='username'
                            helperText='3-30 characters, letters/numbers/underscores only'
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position='start'>
                                        <PersonIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                    </InputAdornment>
                                )
                            }}
                        />
                        <TextField
                            fullWidth label='Email' name='email'
                            type='email' value={form.email}
                            onChange={handleChange} required
                            autoComplete='email'
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position='start'>
                                        <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                    </InputAdornment>
                                )
                            }}
                        />
                        <Box>
                            <TextField
                                fullWidth label='Password' name='password'
                                type={showPass ? 'text' : 'password'}
                                value={form.password} onChange={handleChange}
                                required autoComplete='new-password'
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position='start'>
                                            <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position='end'>
                                            <IconButton onClick={() => setShowPass(p => !p)} edge='end' size='small'>
                                                {showPass
                                                    ? <VisibilityOffIcon fontSize='small' />
                                                    : <VisibilityIcon fontSize='small' />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                            {/* Password strength bar */}
                            {form.password && (
                                <Box sx={{ mt: 1 }}>
                                    <LinearProgress
                                        variant='determinate'
                                        value={(strength / 5) * 100}
                                        sx={{
                                            height: 4, borderRadius: 2,
                                            bgcolor: '#2d2d2d',
                                            '& .MuiLinearProgress-bar': {
                                                bgcolor: STRENGTH_COLORS[strength],
                                                borderRadius: 2
                                            }
                                        }}
                                    />
                                    <Typography variant='caption'
                                        sx={{ color: STRENGTH_COLORS[strength], mt: 0.5, display: 'block' }}>
                                        {STRENGTH_LABELS[strength]}
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        <Button
                            type='submit' variant='contained' fullWidth
                            size='large' disabled={loading}
                            sx={{ py: 1.5, fontSize: '1rem', mt: 1 }}
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </Button>
                    </Stack>
                </Box>

                <Divider sx={{ my: 3, borderColor: '#2d2d2d' }}>
                    <Typography variant='caption' color='text.secondary'>
                        Already have an account?
                    </Typography>
                </Divider>

                <Button
                    variant='outlined' fullWidth size='large'
                    component={Link} to='/login'
                    startIcon={<LoginIcon />} sx={{ py: 1.5 }}
                >
                    Sign In
                </Button>
            </Container>
        </Box>
    )
}