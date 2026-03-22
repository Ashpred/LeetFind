import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { problemsAPI } from '../../services/api'

export const fetchProblems = createAsyncThunk('problems/fetch', async (params, { rejectWithValue }) => {
    try {
        const res = await problemsAPI.getAll(params)
        return res.data.data
    } catch (err) {
        return rejectWithValue(err.response?.data)
    }
})

export const fetchTopics = createAsyncThunk('problems/topics', async (_, { rejectWithValue }) => {
    try {
        const res = await problemsAPI.getTopics()
        return res.data.data.topics
    } catch (err) {
        return rejectWithValue(err.response?.data)
    }
})

const problemSlice = createSlice({
    name: 'problems',
    initialState: { items: [], topics: [], pagination: null, loading: false, error: null },
    reducers: {},
    extraReducers: builder => {
        builder.addCase(fetchProblems.pending,   state => { state.loading = true })
        builder.addCase(fetchProblems.fulfilled, (state, action) => {
            state.loading    = false
            state.items      = action.payload.problems
            state.pagination = action.payload.pagination
        })
        builder.addCase(fetchProblems.rejected,  (state, action) => { state.loading = false; state.error = action.payload })
        builder.addCase(fetchTopics.fulfilled, (state, action) => { state.topics = action.payload })
    }
})

export default problemSlice.reducer