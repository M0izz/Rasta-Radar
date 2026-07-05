import { useState, useEffect } from 'react'
import { fetchAlerts } from '../api/floodData.js'
import { AlertTriangle, Info, MapPin, Users, RefreshCw } from 'lucide-react'

export default function ReportsAlerts() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadAlerts = () => {
    setLoading(true)
    fetchAlerts()
      .then(setData)
      .catch(() => setError('Could not load reports and alerts data.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAlerts()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAlerts()
      .then(setData)
      .catch(console.error)
      .finally(() => setRefreshing(false))
  }

  if (loading) return <div className="loading-screen">Loading Alerts…</div>
  if (error) return <div className="detail-page"><div className="error-msg">{error}</div></div>
  if (!data) return null

  const formatISTTime = (isoString) => {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'
  }

  return (
    <div className="reports-page">
      <div className="reports-header-row">
        <div>
          <h1>Reports & Alerts</h1>
          <p className="page-sub">
            Hyperlocal community updates and official meteorological advisories in Mumbai.
          </p>
        </div>
        <button className={`nowcast-refresh-btn ${refreshing ? 'spinning' : ''}`} onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={13} />
          {refreshing ? 'Refreshing…' : 'Refresh Feed'}
        </button>
      </div>

      <div className="reports-grid">
        {/* Bulletins Section */}
        <div className="bulletins-col">
          <h2 className="column-title">Official Bulletins & Advisories</h2>
          <div className="bulletin-list">
            {data.bulletins?.map((b) => (
              <div key={b.id} className={`bulletin-card ${b.type}`}>
                <div className="bulletin-badge-row">
                  <span className="bulletin-badge">
                    <AlertTriangle size={12} style={{ marginRight: 4 }} />
                    {b.type.toUpperCase().replace('_', ' ')}
                  </span>
                  <span className="bulletin-time">{formatISTTime(b.timestamp)}</span>
                </div>
                <h3>{b.title}</h3>
                <p className="bulletin-content">{b.content}</p>
                <div className="bulletin-source">Source: {b.source}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hotspots & User Reports Section */}
        <div className="feed-col">
          {/* Section A: Active Hotspots */}
          <div className="hotspots-section">
            <h2 className="column-title">Active High-Risk Hotspots ({data.hotspots?.length || 0})</h2>
            <div className="alerts-spot-list">
              {data.hotspots && data.hotspots.length > 0 ? (
                data.hotspots.map((spot) => (
                  <div key={spot.id} className={`alerts-spot-card ${spot.risk_level}`}>
                    <div className="alerts-spot-info">
                      <div className="alerts-spot-name-row">
                        <span className="spot-name">{spot.name}</span>
                        <span className={`risk-badge-mini ${spot.risk_level}`}>{spot.risk_score}</span>
                      </div>
                      <span className="spot-area">
                        <MapPin size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                        {spot.area}
                      </span>
                      <p className="spot-guidance"><strong>Advice:</strong> {spot.leave_by}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-alert-state">
                  <Info size={16} />
                  <span>No critical hotspots active right now.</span>
                </div>
              )}
            </div>
          </div>

          {/* Section B: Community Reports */}
          <div className="community-section" style={{ marginTop: 24 }}>
            <h2 className="column-title">Community Confirmed Incidents ({data.community_alerts?.length || 0})</h2>
            <div className="alerts-spot-list">
              {data.community_alerts && data.community_alerts.length > 0 ? (
                data.community_alerts.map((item) => (
                  <div key={item.id} className="alerts-spot-card community">
                    <div className="alerts-spot-info">
                      <div className="alerts-spot-name-row">
                        <span className="spot-name">{item.name}</span>
                        <span className="votes-count-badge">
                          <Users size={12} style={{ marginRight: 4 }} />
                          {item.confirms} confirms
                        </span>
                      </div>
                      <span className="spot-area">
                        <MapPin size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                        {item.area}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-alert-state">
                  <Users size={16} />
                  <span>No community reports filed in the last hour.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
