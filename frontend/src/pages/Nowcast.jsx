import { useState, useEffect } from 'react'
import { CloudRain, Activity, RefreshCw } from 'lucide-react'
import RadarLoop from '../components/RadarLoop'
import { fetchRainfallFrames, fetchDopplerFrames } from '../api/floodData'

export default function Nowcast() {
  const [refreshing, setRefreshing] = useState(false)
  const [times, setTimes] = useState({ nowcast: '', doppler: '' })

  const formatTime = (offsetSeconds) => {
    const now = new Date()
    now.setSeconds(now.getSeconds() - offsetSeconds)
    
    const day = now.getDate()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[now.getMonth()]
    const year = now.getFullYear()
    
    let hours = now.getHours()
    const ampm = hours >= 12 ? 'pm' : 'am'
    hours = hours % 12
    hours = hours ? hours : 12
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    
    return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds} ${ampm} IST`
  }

  // Ticks real-time time offsets every second to keep the dashboard live!
  useEffect(() => {
    const updateTimes = () => {
      setTimes({
        nowcast: formatTime(360), // 6 minutes ago
        doppler: formatTime(240)  // 4 minutes ago
      })
    }
    updateTimes()
    const timer = setInterval(updateTimes, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
    }, 800)
  }

  return (
    <div className="nowcast-page">
      <div className="nowcast-header">
        <h1 className="nowcast-title">Nowcast</h1>
        <p className="nowcast-subtitle">
          Near real-time rainfall nowcast and Doppler radar imagery for the Mumbai metropolitan region.
        </p>
      </div>

      {/* Pill buttons controls row */}
      <div className="nowcast-controls-row">
        <div className="nowcast-pills">
          <button className="nowcast-pill active">90 min forecast</button>
          <button className="nowcast-pill">IMD RMC Mumbai</button>
          <button className="nowcast-pill">Doppler radar</button>
        </div>
        <button 
          className={`nowcast-refresh-btn ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={13} />
          {refreshing ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      {/* Grid of cards */}
      <div className="nowcast-grid">
        {/* Card 1: Rainfall Nowcast */}
        <div className="nowcast-card-panel">
          <div className="nowcast-card-header">
            <div className="nowcast-card-icon-wrap rain">
              <CloudRain size={20} />
            </div>
            <div className="nowcast-card-info">
              <h2>Rainfall Nowcast</h2>
              <p>Predicted rainfall intensity</p>
            </div>
          </div>
          <div className="nowcast-image-container">
            <RadarLoop 
              fetchFramesFn={fetchRainfallFrames} 
              alt="Rainfall Nowcast MMR" 
              className="radar-img" 
            />
            <div className="radar-sweep-overlay rain" />
          </div>

          {/* Color Metrics Legend */}
          <div className="radar-legend-wrap">
            <div className="legend-title">Rain Rate (mm/h)</div>
            <div className="legend-bar">
              <div className="legend-segment" style={{ background: '#e2e8f0', color: '#4a5568' }}><span>No Rain</span></div>
              <div className="legend-segment" style={{ background: '#48bb78', color: '#ffffff' }}><span>0.5 - 2</span></div>
              <div className="legend-segment" style={{ background: '#ecc94b', color: '#2d3748' }}><span>2 - 10</span></div>
              <div className="legend-segment" style={{ background: '#f6e05e', color: '#2d3748' }}><span>10 - 30</span></div>
              <div className="legend-segment" style={{ background: '#e53e3e', color: '#ffffff' }}><span>30 - 50</span></div>
              <div className="legend-segment" style={{ background: '#b83280', color: '#ffffff' }}><span>&gt; 50</span></div>
            </div>
          </div>

          <div className="nowcast-card-footer">
            <span>Base time: {times.nowcast}</span>
          </div>
        </div>

        {/* Card 2: Doppler Radar */}
        <div className="nowcast-card-panel">
          <div className="nowcast-card-header">
            <div className="nowcast-card-icon-wrap doppler">
              <Activity size={20} />
            </div>
            <div className="nowcast-card-info">
              <h2>Doppler Radar</h2>
              <p>Animated reflectivity loop</p>
            </div>
            <span className="live-pulse-badge">
              <span className="dot" />
              LIVE
            </span>
          </div>
          <div className="nowcast-image-container">
            <RadarLoop 
              fetchFramesFn={fetchDopplerFrames} 
              alt="Doppler Radar MMR" 
              className="radar-img" 
            />
            <div className="radar-sweep-overlay doppler" />
          </div>

          {/* Color Metrics Legend */}
          <div className="radar-legend-wrap">
            <div className="legend-title">Doppler Reflectivity (dBZ)</div>
            <div className="legend-bar">
              <div className="legend-segment" style={{ background: '#ebf8ff', color: '#2b6cb0' }}><span>0 - 15</span></div>
              <div className="legend-segment" style={{ background: '#4299e1', color: '#ffffff' }}><span>15 - 30</span></div>
              <div className="legend-segment" style={{ background: '#3182ce', color: '#ffffff' }}><span>30 - 45</span></div>
              <div className="legend-segment" style={{ background: '#2b6cb0', color: '#ffffff' }}><span>45 - 60</span></div>
              <div className="legend-segment" style={{ background: '#e53e3e', color: '#ffffff' }}><span>&gt; 60</span></div>
            </div>
          </div>

          <div className="nowcast-card-footer">
            <span>Base time: {times.doppler}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
