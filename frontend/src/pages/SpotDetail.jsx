import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchSpot, confirmSpot, denySpot } from '../api/floodData.js'
import { ChevronLeft, MapPin, Share2 } from 'lucide-react'

export default function SpotDetail() {
  const { spotId } = useParams()
  const isAuthenticated = !!localStorage.getItem('rasta_auth_token')
  const [spot, setSpot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [voting, setVoting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchSpot(spotId)
      .then(setSpot)
      .catch(() => setError('Could not load this spot.'))
      .finally(() => setLoading(false))
  }, [spotId])

  async function handleConfirm() {
    setVoting(true)
    try {
      const res = await confirmSpot(spotId)
      setSpot(prev => ({ ...prev, community: res.community }))
    } finally {
      setVoting(false)
    }
  }

  async function handleDeny() {
    setVoting(true)
    try {
      const res = await denySpot(spotId)
      setSpot(prev => ({ ...prev, community: res.community }))
    } finally {
      setVoting(false)
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="loading-screen">Loading…</div>
  if (error) return <div className="detail-page"><div className="error-msg">{error}</div></div>
  if (!spot) return null

  const components = spot.risk_components || {}
  const totalScore = spot.risk_score || 0

  return (
    <div className="detail-page">
      <Link to="/" className="detail-back">
        <ChevronLeft size={14} />
        Back to dashboard
      </Link>

      <div className="detail-title-row">
        <h1 className="detail-name">{spot.name}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="share-btn" onClick={handleShare} title="Copy link to share">
            <Share2 size={13} />
            {copied ? 'Copied!' : 'Share'}
          </button>
          <span className={`risk-pill ${spot.risk_level}`}>
            {spot.risk_level.toUpperCase()} — {Math.round(totalScore)}
          </span>
        </div>
      </div>
      <div className="detail-area">
        <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        {spot.area}
      </div>

      <div className="detail-grid">
        <div className="detail-main-col">
          {spot.description && (
            <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: 16 }}>
              {spot.description}
            </p>
          )}

          {/* Guidance */}
          <div style={{
            background: spot.risk_level === 'high' ? '#fdf0ef' : spot.risk_level === 'moderate' ? '#fdf8ee' : '#eaf5ef',
            border: `1px solid ${spot.risk_level === 'high' ? '#e8b4b0' : spot.risk_level === 'moderate' ? '#dfc980' : '#a8d8bc'}`,
            padding: '10px 14px',
            marginBottom: 16,
            borderRadius: 3,
            fontSize: '0.88rem',
            color: '#333',
          }}>
            <strong>Guidance:</strong> {spot.leave_by}
          </div>

          {/* Stat cards */}
          <div className="stat-cards-row">
            <div className="stat-card">
              <div className="stat-card-label">Rainfall (3h)</div>
              <div className="stat-card-value">
                {(components.rainfall_mm_3h ?? 0).toFixed(1)}
                <span className="stat-card-unit">mm</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Hist. Severity</div>
              <div className="stat-card-value">
                {spot.historical_severity}
                <span className="stat-card-unit">/5</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Risk Score</div>
              <div className="stat-card-value">{Math.round(totalScore)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Tide State</div>
              <div className="stat-card-value" style={{ fontSize: '1.2rem', paddingTop: 4, textTransform: 'capitalize' }}>
                {components.tide_state ?? 'normal'}
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="score-breakdown">
            <h3>Score breakdown</h3>
            <div className="score-bar-row">
              <span className="score-bar-label">Rainfall × 0.6</span>
              <div className="score-bar-track">
                <div
                  className="score-bar-fill"
                  style={{ width: `${Math.min((components.rainfall_contribution / 60) * 100, 100)}%`, background: '#1a6e7e' }}
                />
              </div>
              <span className="score-bar-val">{components.rainfall_contribution ?? 0}</span>
            </div>
            <div className="score-bar-row">
              <span className="score-bar-label">Severity × 0.3 × 20</span>
              <div className="score-bar-track">
                <div
                  className="score-bar-fill"
                  style={{ width: `${(components.severity_contribution / 30) * 100}%`, background: '#b7770d' }}
                />
              </div>
              <span className="score-bar-val">{components.severity_contribution ?? 0}</span>
            </div>
            <div className="score-bar-row">
              <span className="score-bar-label">Tide bonus × 0.1 × 100</span>
              <div className="score-bar-track">
                <div
                  className="score-bar-fill"
                  style={{ width: `${(components.tide_contribution / 10) * 100}%`, background: '#5b8dc8' }}
                />
              </div>
              <span className="score-bar-val">{components.tide_contribution ?? 0}</span>
            </div>
            <div className="disclaimer-line">
              Risk score = live rainfall + historical flood severity + tide timing. Not a calibrated prediction.
            </div>
          </div>
        </div>

        <div className="detail-sidebar-col">
          {/* Community widget */}
          <div className="community-widget detail-sidebar-widget" style={{ marginBottom: 0 }}>
            <h3>Community check</h3>
            <p>Have you passed through here recently? Help others by reporting conditions.</p>
            {!isAuthenticated ? (
              <div className="auth-voting-notice">
                <span>Please <Link to="/auth">Sign In</Link> to report waterlogging.</span>
              </div>
            ) : (
              <div className="community-btns">
                <button
                  className="community-btn confirm"
                  onClick={handleConfirm}
                  disabled={voting}
                >
                  Still flooded
                </button>
                <button
                  className="community-btn deny"
                  onClick={handleDeny}
                  disabled={voting}
                >
                  Clear now
                </button>
              </div>
            )}
            <div className="community-counts">
              <div className="community-count-item">
                <span>{spot.community?.confirms ?? 0}</span> reported flooded
              </div>
              <div className="community-count-item">
                <span>{spot.community?.denies ?? 0}</span> reported clear
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="source-note detail-sidebar-widget">
            Data source: {spot.source_note}
          </div>
        </div>
      </div>
    </div>
  )
}
