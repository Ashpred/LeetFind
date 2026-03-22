// src/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authAPI } from '../../services/api'

export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
    try {
        const res = await authAPI.register(data)
        localStorage.setItem('accessToken', res.data.accessToken)
        return res.data
    } catch (err) {
        return rejectWithValue(err.response?.data || { message: 'Registration failed' })
    }
})

export const loginUser = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
    try {
        const res = await authAPI.login(data)
        localStorage.setItem('accessToken', res.data.accessToken)
        return res.data
    } catch (err) {
        return rejectWithValue(err.response?.data || { message: 'Login failed' })
    }
})

export const logoutUser = createAsyncThunk('auth/logout', async () => {
    await authAPI.logout()
    localStorage.removeItem('accessToken')
})

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
    try {
        const res = await authAPI.me()
        return res.data
    } catch (err) {
        return rejectWithValue(err.response?.data)
    }
})

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user:    null,
        token:   localStorage.getItem('accessToken'),
        loading: false,
        error:   null,
    },
    reducers: {
        clearError: state => { state.error = null }
    },
    extraReducers: builder => {
        // Register
        builder.addCase(registerUser.pending,   state => { state.loading = true;  state.error = null })
        builder.addCase(registerUser.fulfilled, (state, action) => {
            state.loading = false
            state.user    = action.payload.user
            state.token   = action.payload.accessToken
        })
        builder.addCase(registerUser.rejected,  (state, action) => {
            state.loading = false
            state.error   = action.payload
        })
        // Login
        builder.addCase(loginUser.pending,   state => { state.loading = true;  state.error = null })
        builder.addCase(loginUser.fulfilled, (state, action) => {
            state.loading = false
            state.user    = action.payload.user
            state.token   = action.payload.accessToken
        })
        builder.addCase(loginUser.rejected,  (state, action) => {
            state.loading = false
            state.error   = action.payload
        })
        // Logout
        builder.addCase(logoutUser.fulfilled, state => {
            state.user  = null
            state.token = null
        })
        // Me
        builder.addCase(fetchMe.fulfilled, (state, action) => {
            state.user = action.payload.user
        })
    }
})

export const { clearError } = authSlice.actions
export default authSlice.reducer
