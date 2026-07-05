import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import SpotDetail from './pages/SpotDetail.jsx'
import RouteCompare from './pages/RouteCompare.jsx'
import Nowcast from './pages/Nowcast.jsx'
import WaterLevel from './pages/WaterLevel.jsx'
import AlertBanner from './components/AlertBanner.jsx'
import { useState, useEffect } from 'react'
import { fetchSpots } from './api/floodData.js'
import { Menu, X } from 'lucide-react'

export default function App() {
  const [spotsData, setSpotsData] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetchSpots().then(setSpotsData).catch(console.error)
    const interval = setInterval(() => {
      fetchSpots().then(setSpotsData).catch(console.error)
    }, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(interval)
  }, [])

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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
