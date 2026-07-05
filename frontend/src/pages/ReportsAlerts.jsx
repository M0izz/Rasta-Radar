import { useState, useEffect } from 'react'
import { fetchAlerts } from '../api/floodData.js'
import { AlertOctagon, Waves, AlertTriangle, MapPin, Users, RefreshCw, Megaphone, Clock } from 'lucide-react'

export default function ReportsAlerts() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('hotspots') // 'hotspots' or 'community'

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

  const getBulletinIcon = (type) => {
    switch (type) {
      case 'red_alert':
        return <AlertOctagon size={18} className="bulletin-type-icon text-red" />
      case 'tide_warning':
        return <Waves size={18} className="bulletin-type-icon text-blue" />
      case 'traffic_warning':
        return <AlertTriangle size={18} className="bulletin-type-icon text-orange" />
      default:
        return <Megaphone size={18} className="bulletin-type-icon text-teal" />
    }
  }

  return (
    <div className="reports-page">
      <div className="reports-header-row">
        <div>
          <h1 className="gradient-text">Reports & Alerts</h1>
          <p className="page-sub">
            Real-time emergency monitoring, official meteorological bulletins, and crowd-sourced advisory updates.
          </p>
        </div>
        <button className={`nowcast-refresh-btn ${refreshing ? 'spinning' : ''}`} onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={13} />
          {refreshing ? 'Refreshing…' : 'Refresh Feed'}
        </button>
      </div>

      <div className="reports-grid">
        {/* Hotspots & User Reports Section */}
        <div className="feed-col">
          {/* Tabs header */}
          <div className="reports-tabs-header">
            <button 
              className={`reports-tab-btn ${activeTab === 'hotspots' ? 'active' : ''}`}
              onClick={() => setActiveTab('hotspots')}
            >
              <span>Active Hotspots</span>
              <span className="tab-count-badge bg-red">{data.hotspots?.length || 0}</span>
            </button>
            <button 
              className={`reports-tab-btn ${activeTab === 'community' ? 'active' : ''}`}
              onClick={() => setActiveTab('community')}
            >
              <span>Community Reports</span>
              <span className="tab-count-badge bg-blue">{data.community_alerts?.length || 0}</span>
            </button>
          </div>

          <div className="tab-content-panel glassmorphic">
            {activeTab === 'hotspots' && (
              <div className="alerts-spot-list animate-fade-in">
                {data.hotspots && data.hotspots.length > 0 ? (
                  data.hotspots.map((spot) => (
                    <div key={spot.id} className={`alerts-spot-card ${spot.risk_level}`}>
                      <div className="alerts-spot-info">
                        <div className="alerts-spot-name-row">
                          <span className="spot-name">{spot.name}</span>
                          <span className={`risk-badge-mini ${spot.risk_level}`}>
                            Score: {spot.risk_score}
                          </span>
                        </div>
                        <span className="spot-area">
                          <MapPin size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          {spot.area}
                        </span>
                        <div className="spot-guidance-box">
                          <p className="spot-guidance"><strong>Advisory:</strong> {spot.leave_by}</p>
                        </div>
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
            )}

            {activeTab === 'community' && (
              <div className="alerts-spot-list animate-fade-in">
                {data.community_alerts && data.community_alerts.length > 0 ? (
                  data.community_alerts.map((item) => (
                    <div key={item.id} className="alerts-spot-card community">
                      <div className="alerts-spot-info">
                        <div className="alerts-spot-name-row">
                          <span className="spot-name">{item.name}</span>
                          <span className="votes-count-badge">
                            <Users size={12} style={{ marginRight: 5 }} />
                            {item.confirms} Confirmed Flooded
                          </span>
                        </div>
                        <span className="spot-area">
                          <MapPin size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          {item.area}
                        </span>
                        <div className="spot-guidance-box community">
                          <p className="spot-guidance">
                            <strong>Status:</strong> Verified waterlogged by commuters in this area. Avoid this route if possible.
                          </p>
                        </div>
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
            )}
          </div>
        </div>

        {/* Bulletins Section */}
        <div className="bulletins-col">
          <div className="section-title-wrap">
            <Megaphone size={18} className="text-teal" />
            <h2 className="column-title">Official Bulletins</h2>
          </div>
          <div className="bulletin-list">
            {data.bulletins?.map((b) => (
              <div key={b.id} className={`bulletin-card ${b.type}`}>
                <div className="bulletin-badge-row">
                  <div className="bulletin-badge-left">
                    {getBulletinIcon(b.type)}
                    <span className="bulletin-badge-text">
                      {b.type.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                  <span className="bulletin-time">
                    <Clock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {formatISTTime(b.timestamp)}
                  </span>
                </div>
                <h3>{b.title}</h3>
                <p className="bulletin-content">{b.content}</p>
                <div className="bulletin-source">Issued by: {b.source}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
