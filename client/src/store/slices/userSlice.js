// src/store/slices/userSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { usersAPI } from '../../services/api'

export const fetchDashboard = createAsyncThunk('user/dashboard', async (_, { rejectWithValue }) => {
    try {
        const res = await usersAPI.getDashboard()
        return res.data.data
    } catch (err) {
        return rejectWithValue(err.response?.data)
    }
})

export const fetchSolvedIds = createAsyncThunk('user/solvedIds', async (_, { rejectWithValue }) => {
    try {
        const res = await solvesAPI.getIds()
        return res.data.data.solvedIds || []
    } catch (err) {
        return rejectWithValue(err.response?.data)
    }
})

export const fetchProfile = createAsyncThunk('user/profile', async (_, { rejectWithValue }) => {
    try {
        const res = await usersAPI.getProfile()
        return res.data.data
    } catch (err) {
        return rejectWithValue(err.response?.data)
    }
})

const userSlice = createSlice({
    name: 'user',
    initialState: {
        profile:        null,
        dashboard:      null,
        skillVector:    [],
        topicBreakdown: [],
        loading:        false,
        error:          null,
        solvedIds: [],
    },
    reducers: {},
    extraReducers: builder => {
        builder.addCase(fetchDashboard.pending,   state => { state.loading = true })
        builder.addCase(fetchDashboard.fulfilled, (state, action) => {
            state.loading        = false
            state.dashboard      = action.payload
            state.skillVector    = action.payload.skillVector    || []
            state.topicBreakdown = action.payload.topicBreakdown || []
        })
        builder.addCase(fetchDashboard.rejected,  (state, action) => {
            state.loading = false
            state.error   = action.payload
        })
        builder.addCase(fetchProfile.fulfilled, (state, action) => {
            state.profile = action.payload.profile
        })
        builder.addCase(fetchSolvedIds.fulfilled, (state, action) => {
            state.solvedIds = action.payload
        })
    }
})

export default userSlice.reducer






