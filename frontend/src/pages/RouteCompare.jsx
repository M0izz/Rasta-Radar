import { useState, useEffect } from 'react'
import { fetchRoutes } from '../api/floodData.js'

const ROUTE_OPTIONS = [
  { id: 'western_highway', label: 'Western Express Highway' },
  { id: 'eastern_express', label: 'Eastern Express Highway' },
  { id: 'dadar_sion', label: 'Dadar–Sion Corridor' },
  { id: 'harbour_belt', label: 'Harbour Belt Road' },
  { id: 'andheri_santacruz', label: 'Andheri–Santacruz Link' },
  { id: 'thane_mulund', label: 'Thane–Mulund Corridor' },
  { id: 'thane_belapur', label: 'Thane–Belapur Road' },
  { id: 'palm_beach', label: 'Palm Beach Marg (Navi Mumbai)' },
  { id: 'trans_harbour', label: 'Trans-Harbour Link Approach' },
  { id: 'uran_jnpt', label: 'Uran–JNPT Corridor' },
  { id: 'ulwe_airport', label: 'Ulwe–Airport Corridor' },
  { id: 'vasai_virar_expressway', label: 'Mumbai–Vasai–Virar Corridor' },
]


function buildRecommendation(routeA, routeB) {
  if (!routeA || !routeB) return null

  const aScore = routeA.avg_risk_score
  const bScore = routeB.avg_risk_score
  const aHigh = routeA.high_risk_spots
  const bHigh = routeB.high_risk_spots

  if (aHigh === 0 && bHigh === 0) {
    return `Both routes currently show no high-risk spots. ${aScore < bScore ? routeA.label : routeB.label} has a slightly lower average risk score (${Math.min(aScore, bScore)} vs ${Math.max(aScore, bScore)}). Either route is fine right now.`
  }

  if (aHigh < bHigh) {
    return `Take ${routeA.label} — it has ${aHigh} high-risk spot${aHigh !== 1 ? 's' : ''} vs ${bHigh} on ${routeB.label}. Expect delays near ${routeA.spots?.filter(s => s.risk_level === 'high').map(s => s.name).join(', ') || 'marked spots'}.`
  }
  if (bHigh < aHigh) {
    return `Take ${routeB.label} — it has ${bHigh} high-risk spot${bHigh !== 1 ? 's' : ''} vs ${aHigh} on ${routeA.label}. Expect delays near ${routeB.spots?.filter(s => s.risk_level === 'high').map(s => s.name).join(', ') || 'marked spots'}.`
  }

  // Equal high-risk count, compare average score
  if (aScore <= bScore) {
    return `Both routes have ${aHigh} high-risk spot${aHigh !== 1 ? 's' : ''}, but ${routeA.label} has a lower average risk score (${aScore} vs ${bScore}). Lean toward ${routeA.label}, but plan for delays.`
  }
  return `Both routes have ${aHigh} high-risk spot${aHigh !== 1 ? 's' : ''}, but ${routeB.label} has a lower average risk score (${bScore} vs ${aScore}). Lean toward ${routeB.label}, but plan for delays.`
}

function RoutePanel({ route }) {
  if (!route) {
    return (
      <div className="route-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '0.85rem' }}>
        Select a route above
      </div>
    )
  }

  return (
    <div className="route-panel">
      <div className="route-panel-name">{route.label}</div>
      <div className="route-panel-desc">{route.description}</div>
      <div className="route-panel-stats">
        <div className="route-mini-stat">
          <div className={`route-mini-stat-val ${route.high_risk_spots > 0 ? 'danger' : ''}`}>
            {route.high_risk_spots}
          </div>
          <div className="route-mini-stat-label">High risk</div>
        </div>
        <div className="route-mini-stat">
          <div className={`route-mini-stat-val ${route.moderate_risk_spots > 0 ? 'moderate' : ''}`}>
            {route.moderate_risk_spots}
          </div>
          <div className="route-mini-stat-label">Moderate</div>
        </div>
        <div className="route-mini-stat">
          <div className="route-mini-stat-val">{route.avg_risk_score}</div>
          <div className="route-mini-stat-label">Avg score</div>
        </div>
      </div>

      <div className="route-spot-list">
        {route.spots?.map(spot => (
          <div key={spot.id} className="route-spot-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className={`route-spot-dot ${spot.risk_level}`} />
              <span>{spot.name}</span>
            </div>
            <span style={{ color: '#aaa', fontSize: '0.72rem' }}>{Math.round(spot.risk_score)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RouteCompare() {
  const [routesData, setRoutesData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedA, setSelectedA] = useState('western_highway')
  const [selectedB, setSelectedB] = useState('eastern_express')

  useEffect(() => {
    fetchRoutes()
      .then(setRoutesData)
      .catch(() => setError('Could not load route data. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-screen">Loading route data…</div>
  if (error) return <div className="route-page"><div className="error-msg">{error}</div></div>

  const routeMap = {}
  routesData?.routes?.forEach(r => { routeMap[r.id] = r })

  const routeA = routeMap[selectedA]
  const routeB = routeMap[selectedB]
  const recommendation = buildRecommendation(routeA, routeB)

  return (
    <div className="route-page">
      <h1>Route Comparison</h1>
      <p className="page-sub">
        Compare risk spot counts across two named routes — Mumbai, Thane, and Navi Mumbai.
        Based on which known flood spots each route passes through — not real turn-by-turn routing.
      </p>


      <div className="route-selectors">
        <div>
          <label className="route-select-label">Route A</label>
          <select
            className="route-select"
            value={selectedA}
            onChange={e => setSelectedA(e.target.value)}
          >
            {ROUTE_OPTIONS.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="route-select-label">Route B</label>
          <select
            className="route-select"
            value={selectedB}
            onChange={e => setSelectedB(e.target.value)}
          >
            {ROUTE_OPTIONS.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="route-compare-grid">
        <RoutePanel route={routeA} />
        <RoutePanel route={routeB} />
      </div>

      {recommendation && (
        <div className="recommendation-box">
          <h3>Recommendation</h3>
          <p className="recommendation-text">{recommendation}</p>
          <p className="disclaimer-line" style={{ marginTop: 8 }}>
            Risk score = live rainfall + historical flood severity + tide timing. Not a calibrated prediction.
          </p>
        </div>
      )}
    </div>
  )
}
