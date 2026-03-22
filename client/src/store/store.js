// src/store/store.js
import { configureStore } from '@reduxjs/toolkit'
import authReducer    from './slices/authSlice'
import userReducer    from './slices/userSlice'
import problemReducer from './slices/problemSlice'
import recsReducer    from './slices/recsSlice'

export const store = configureStore({
    reducer: {
        auth:     authReducer,
        user:     userReducer,
        problems: problemReducer,
        recs:     recsReducer,
    }
})

export default store
