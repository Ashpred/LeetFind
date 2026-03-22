import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { recsAPI } from '../../services/api'

export const fetchRecommendations = createAsyncThunk('recs/fetch', async (params, { rejectWithValue }) => {
    try {
        const res = await recsAPI.get(params)
        return res.data.data
    } catch (err) {
        return rejectWithValue(err.response?.data)
    }
})

const recsSlice = createSlice({
    name: 'recs',
    initialState: { items: [], loading: false, cached: false, error: null },
    reducers: {},
    extraReducers: builder => {
        builder.addCase(fetchRecommendations.pending,   state => { state.loading = true; state.error = null })
        builder.addCase(fetchRecommendations.fulfilled, (state, action) => {
            state.loading = false
            state.items   = action.payload.recommendations || []
            state.cached  = action.payload.cached
        })
        builder.addCase(fetchRecommendations.rejected,  (state, action) => { state.loading = false; state.error = action.payload })
    }
})

export default recsSlice.reducer