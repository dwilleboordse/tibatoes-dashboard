import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OKRs from './pages/OKRs'
import Calendar from './pages/Calendar'
import CreativeRoadmap from './pages/CreativeRoadmap'
import Revenue from './pages/Revenue'
import Creators from './pages/Creators'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index               element={<Dashboard />} />
        <Route path="okrs"             element={<OKRs />} />
        <Route path="calendar"         element={<Calendar />} />
        <Route path="creative-roadmap" element={<CreativeRoadmap />} />
        <Route path="revenue"          element={<Revenue />} />
        <Route path="creators"         element={<Creators />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
