// src/theme/theme.js — MUI Theme
import { createTheme } from '@mui/material/styles'

const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main:  '#6366f1',   // indigo
            light: '#818cf8',
            dark:  '#4f46e5',
        },
        secondary: {
            main:  '#f59e0b',   // amber
            light: '#fbbf24',
            dark:  '#d97706',
        },
        success: { main: '#4ade80' },
        error:   { main: '#f87171' },
        warning: { main: '#fb923c' },
        background: {
            default: '#0f0f0f',
            paper:   '#1a1a1a',
        },
        text: {
            primary:   '#f1f5f9',
            secondary: '#94a3b8',
        },
        divider: '#2d2d2d',
    },
    typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
        h1: { fontWeight: 800, letterSpacing: '-0.02em' },
        h2: { fontWeight: 700, letterSpacing: '-0.01em' },
        h3: { fontWeight: 700 },
        h4: { fontWeight: 600 },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
        button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '10px 24px',
                    fontSize: '0.9rem',
                },
                containedPrimary: {
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                    }
                }
            }
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid #2d2d2d',
                    '&:hover': { borderColor: '#6366f1' },
                    transition: 'border-color 0.2s ease, transform 0.2s ease',
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: { borderRadius: 6, fontWeight: 500, fontSize: '0.75rem' }
            }
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                        '& fieldset': { borderColor: '#2d2d2d' },
                        '&:hover fieldset': { borderColor: '#6366f1' },
                    }
                }
            }
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#0f0f0f',
                    borderBottom: '1px solid #2d2d2d',
                    boxShadow: 'none',
                }
            }
        },
    }
})

export default theme
