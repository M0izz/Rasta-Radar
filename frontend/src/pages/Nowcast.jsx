import { useState, useEffect } from 'react'
import { CloudRain, Activity, RefreshCw, AlertCircle } from 'lucide-react'
import { fetchRainfallLatest, fetchDopplerLatest } from '../api/floodData'

export default function Nowcast() {
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [rainfall, setRainfall] = useState(null)
  const [doppler, setDoppler] = useState(null)

  const loadLatestImages = () => {
    setLoading(true)
    Promise.all([fetchRainfallLatest(), fetchDopplerLatest()])
      .then(([rainData, dopplerData]) => {
        setRainfall(rainData)
        setDoppler(dopplerData)
      })
      .catch((err) => {
        console.error(err)
        setError('Could not load latest radar images.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadLatestImages()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    Promise.all([fetchRainfallLatest(), fetchDopplerLatest()])
      .then(([rainData, dopplerData]) => {
        setRainfall(rainData)
        setDoppler(dopplerData)
      })
      .catch(console.error)
      .finally(() => {
        setTimeout(() => setRefreshing(false), 500)
      })
  }

  const formatIST = (isoString) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    const day = d.getDate()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[d.getMonth()]
    const year = d.getFullYear()
    
    let hours = d.getHours()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    const minutes = String(d.getMinutes()).padStart(2, '0')
    
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm} IST`
  }

  if (loading) return <div className="loading-screen">Loading radar images…</div>
  if (error) return <div className="detail-page"><div className="error-msg">{error}</div></div>

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
          <button className="nowcast-pill active">Latest imagery</button>
          <button className="nowcast-pill">IMD RMC Mumbai</button>
          <button className="nowcast-pill">Doppler radar</button>
        </div>
        <button 
          className={`nowcast-refresh-btn ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={13} />
          {refreshing ? 'Refreshing…' : 'Refresh image'}
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
              <p>Current rainfall intensity</p>
            </div>
          </div>
          <div className="nowcast-image-container">
            {rainfall?.url ? (
              <>
                <img 
                  src={rainfall.url} 
                  alt="Rainfall Nowcast MMR" 
                  className="radar-img" 
                />
                <div className="radar-time-badge glassmorphic">
                  {formatIST(rainfall.timestamp)}
                </div>
              </>
            ) : (
              <div className="empty-alert-state">
                <AlertCircle size={16} />
                <span>No rainfall image available.</span>
              </div>
            )}
          </div>

          <div className="nowcast-card-footer">
            <span>Telemetred timestamp: {formatIST(rainfall?.timestamp)}</span>
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
              <p>Current reflectivity index</p>
            </div>
            <span className="live-pulse-badge">
              <span className="dot" />
              LIVE
            </span>
          </div>
          <div className="nowcast-image-container">
            {doppler?.url ? (
              <>
                <img 
                  src={doppler.url} 
                  alt="Doppler Radar MMR" 
                  className="radar-img" 
                />
                <div className="radar-time-badge glassmorphic">
                  {formatIST(doppler.timestamp)}
                </div>
              </>
            ) : (
              <div className="empty-alert-state">
                <AlertCircle size={16} />
                <span>No Doppler image available.</span>
              </div>
            )}
          </div>

          <div className="nowcast-card-footer">
            <span>Telemetred timestamp: {formatIST(doppler?.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
