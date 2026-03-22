// src/components/layout/Navbar.jsx
import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
    AppBar, Toolbar, Typography, Button, Box,
    IconButton, Avatar, Menu, MenuItem, Divider, Chip
} from '@mui/material'
import CodeIcon          from '@mui/icons-material/Code'
import DashboardIcon     from '@mui/icons-material/Dashboard'
import ListIcon          from '@mui/icons-material/List'
import AutoAwesomeIcon   from '@mui/icons-material/AutoAwesome'
import PersonIcon        from '@mui/icons-material/Person'
import LogoutIcon        from '@mui/icons-material/Logout'
import { logoutUser }    from '../../store/slices/authSlice'

const NAV_LINKS = [
    { label: 'Dashboard',       path: '/dashboard',       icon: <DashboardIcon fontSize='small' /> },
    { label: 'Problems',        path: '/problems',        icon: <ListIcon fontSize='small' /> },
    { label: 'Recommendations', path: '/recommendations', icon: <AutoAwesomeIcon fontSize='small' /> },
]

export default function Navbar() {
    const navigate          = useNavigate()
    const location          = useLocation()
    const dispatch          = useDispatch()
    const { user, token }   = useSelector(state => state.auth)
    const [anchor, setAnchor] = useState(null)

    const handleLogout = async () => {
        await dispatch(logoutUser())
        navigate('/')
        setAnchor(null)
    }

    return (
        <AppBar position='sticky'>
            <Toolbar sx={{ gap: 1 }}>
                {/* Logo */}
                <Box
                    component={Link}
                    to='/'
                    sx={{ display: 'flex', alignItems: 'center', gap: 1,
                          textDecoration: 'none', color: 'inherit', mr: 3 }}
                >
                    <CodeIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                    <Typography variant='h6' fontWeight={700} sx={{
                        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        AlgoRec
                    </Typography>
                </Box>

                {/* Nav links — only when logged in */}
                {token && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexGrow: 1 }}>
                        {NAV_LINKS.map(link => (
                            <Button
                                key={link.path}
                                component={Link}
                                to={link.path}
                                startIcon={link.icon}
                                size='small'
                                sx={{
                                    color: location.pathname.startsWith(link.path)
                                        ? 'primary.main' : 'text.secondary',
                                    bgcolor: location.pathname.startsWith(link.path)
                                        ? 'rgba(99,102,241,0.1)' : 'transparent',
                                    '&:hover': { color: 'primary.light' }
                                }}
                            >
                                {link.label}
                            </Button>
                        ))}
                    </Box>
                )}

                <Box sx={{ flexGrow: token ? 0 : 1 }} />

                {/* Auth buttons */}
                {!token ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant='outlined' size='small' onClick={() => navigate('/login')}>
                            Login
                        </Button>
                        <Button variant='contained' size='small' onClick={() => navigate('/register')}>
                            Get Started
                        </Button>
                    </Box>
                ) : (
                    <>
                        <IconButton onClick={e => setAnchor(e.currentTarget)} size='small'>
                            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.9rem' }}>
                                {user?.username?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                        </IconButton>
                        <Menu
                            anchorEl={anchor}
                            open={Boolean(anchor)}
                            onClose={() => setAnchor(null)}
                            PaperProps={{ sx: { mt: 1, minWidth: 180, bgcolor: 'background.paper' } }}
                        >
                            <Box sx={{ px: 2, py: 1 }}>
                                <Typography variant='subtitle2' fontWeight={600}>
                                    {user?.username}
                                </Typography>
                                <Typography variant='caption' color='text.secondary'>
                                    {user?.email}
                                </Typography>
                            </Box>
                            <Divider />
                            <MenuItem onClick={() => { navigate('/profile'); setAnchor(null) }}>
                                <PersonIcon fontSize='small' sx={{ mr: 1 }} /> Profile
                            </MenuItem>
                            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                                <LogoutIcon fontSize='small' sx={{ mr: 1 }} /> Logout
                            </MenuItem>
                        </Menu>
                    </>
                )}
            </Toolbar>
        </AppBar>
    )
}
