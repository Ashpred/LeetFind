// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Navbar          from './components/layout/Navbar'
import ProtectedRoute  from './components/layout/ProtectedRoute'
import HomePage        from './pages/HomePage'
import LoginPage       from './pages/LoginPage'
import RegisterPage    from './pages/RegisterPage'
import DashboardPage   from './pages/DashboardPage'
import ProblemsPage    from './pages/ProblemsPage'
import ProblemDetail   from './pages/ProblemDetail'
import RecsPage        from './pages/RecsPage'
import ProfilePage     from './pages/ProfilePage'

export default function App() {
    const { token } = useSelector(state => state.auth)

    return (
        <>
            <Navbar />
            <Routes>
                {/* Public */}
                <Route path='/'         element={<HomePage />} />
                <Route path='/login'    element={token ? <Navigate to='/dashboard' /> : <LoginPage />} />
                <Route path='/register' element={token ? <Navigate to='/dashboard' /> : <RegisterPage />} />

                {/* Protected */}
                <Route element={<ProtectedRoute />}>
                    <Route path='/dashboard'          element={<DashboardPage />} />
                    <Route path='/problems'           element={<ProblemsPage />} />
                    <Route path='/problems/:slug'     element={<ProblemDetail />} />
                    <Route path='/recommendations'    element={<RecsPage />} />
                    <Route path='/profile'            element={<ProfilePage />} />
                </Route>

                {/* Fallback */}
                <Route path='*' element={<Navigate to='/' />} />
            </Routes>
        </>
    )
}
