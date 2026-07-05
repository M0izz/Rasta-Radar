import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import SpotDetail from './pages/SpotDetail.jsx'
import RouteCompare from './pages/RouteCompare.jsx'
import Nowcast from './pages/Nowcast.jsx'
import WaterLevel from './pages/WaterLevel.jsx'
import Auth from './pages/Auth.jsx'
import AIAssistant from './pages/AIAssistant.jsx'
import ReportsAlerts from './pages/ReportsAlerts.jsx'
import SettingsProfile from './pages/SettingsProfile.jsx'
import AlertBanner from './components/AlertBanner.jsx'
import { useState, useEffect } from 'react'
import { fetchSpots } from './api/floodData.js'
import { Menu, X, LogIn, LogOut, ShieldCheck } from 'lucide-react'

export default function App() {
  const [spotsData, setSpotsData] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState(null)
  const [userName, setUserName] = useState(null)

  const syncAuth = () => {
    setUserEmail(localStorage.getItem('rasta_user_email'))
    setUserName(localStorage.getItem('rasta_user_name'))
  }

  useEffect(() => {
    fetchSpots().then(setSpotsData).catch(console.error)
    const interval = setInterval(() => {
      fetchSpots().then(setSpotsData).catch(console.error)
    }, 5 * 60 * 1000) // refresh every 5 min

    // Load initial auth
    syncAuth()

    // Listen for storage events (e.g. login changes)
    window.addEventListener('storage', syncAuth)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', syncAuth)
    }
  }, [])

  const handleSignOut = () => {
    localStorage.removeItem('rasta_auth_token')
    localStorage.removeItem('rasta_user_email')
    localStorage.removeItem('rasta_user_name')
    syncAuth()
    setMenuOpen(false)
  }

  const highCount = spotsData?.meta?.high_risk_count ?? 0

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <span className="logo-text">Rasta Radar</span>
            <span className="logo-sub">Mumbai Waterlogging Advisory</span>
          </div>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <nav className={`topbar-nav ${menuOpen ? 'open' : ''}`}>
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              Dashboard
            </NavLink>
            <NavLink to="/nowcast" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              Nowcast
            </NavLink>
            <NavLink to="/water-level" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              Water Level
            </NavLink>
            <NavLink to="/routes" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              Route Compare
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              Reports & Alerts
            </NavLink>
            <NavLink to="/assistant" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              AI Assistant
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              Settings
            </NavLink>

            {/* Auth section */}
            {userEmail ? (
              <div className="nav-profile-pill">
                <span className="nav-profile-name" title={userEmail}>
                  <ShieldCheck size={13} style={{ marginRight: 4, color: '#38bdf8' }} />
                  {userName || 'User'}
                </span>
                <button className="nav-signout-btn" onClick={handleSignOut} title="Sign Out">
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <Link to="/auth" className="nav-login-btn" onClick={() => setMenuOpen(false)}>
                <LogIn size={13} style={{ marginRight: 5 }} />
                Sign In
              </Link>
            )}
          </nav>
        </header>

        {highCount > 0 && <AlertBanner count={highCount} />}
        
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard spotsData={spotsData} setSpotsData={setSpotsData} />} />
            <Route path="/spot/:spotId" element={<SpotDetail />} />
            <Route path="/nowcast" element={<Nowcast />} />
            <Route path="/water-level" element={<WaterLevel />} />
            <Route path="/routes" element={<RouteCompare />} />
            <Route path="/reports" element={<ReportsAlerts />} />
            <Route path="/assistant" element={<AIAssistant />} />
            <Route path="/settings" element={<SettingsProfile />} />
            <Route path="/auth" element={<Auth />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

