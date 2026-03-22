import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box, Container, Typography, TextField, Button,
    Alert, InputAdornment, IconButton, Divider, Stack
} from '@mui/material'
import EmailIcon         from '@mui/icons-material/Email'
import LockIcon          from '@mui/icons-material/Lock'
import VisibilityIcon    from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CodeIcon          from '@mui/icons-material/Code'
import AutoAwesomeIcon   from '@mui/icons-material/AutoAwesome'
import { loginUser, clearError } from '../store/slices/authSlice'

export default function LoginPage() {
    const navigate  = useNavigate()
    const dispatch  = useDispatch()
    const { loading, error } = useSelector(state => state.auth)

    const [form, setForm]         = useState({ email: '', password: '' })
    const [showPass, setShowPass] = useState(false)

    const handleChange = e => {
        dispatch(clearError())
        setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async e => {
        e.preventDefault()
        const res = await dispatch(loginUser(form))
        if (res.type === 'auth/login/fulfilled') navigate('/dashboard')
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
                top: '-20%', left: '-10%',
                width: '600px', height: '600px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
                pointerEvents: 'none'
            },
            '&::after': {
                content: '""', position: 'absolute',
                bottom: '-20%', right: '-10%',
                width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
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

                <Typography variant='h4' fontWeight={700} mb={1}>Welcome back</Typography>
                <Typography color='text.secondary' mb={4}>
                    Sign in to get your personalized recommendations
                </Typography>

                {error && (
                    <Alert severity='error' sx={{ mb: 3, borderRadius: 2 }}>
                        {error.message || 'Login failed — please try again'}
                    </Alert>
                )}

                <Box component='form' onSubmit={handleSubmit}>
                    <Stack spacing={2.5}>
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
                        <TextField
                            fullWidth label='Password' name='password'
                            type={showPass ? 'text' : 'password'}
                            value={form.password} onChange={handleChange}
                            required autoComplete='current-password'
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
                        <Button
                            type='submit' variant='contained' fullWidth
                            size='large' disabled={loading}
                            sx={{ py: 1.5, fontSize: '1rem', mt: 1 }}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </Stack>
                </Box>

                <Divider sx={{ my: 3, borderColor: '#2d2d2d' }}>
                    <Typography variant='caption' color='text.secondary'>
                        Don't have an account?
                    </Typography>
                </Divider>

                <Button
                    variant='outlined' fullWidth size='large'
                    component={Link} to='/register'
                    startIcon={<AutoAwesomeIcon />} sx={{ py: 1.5 }}
                >
                    Create Free Account
                </Button>
            </Container>
        </Box>
    )
}