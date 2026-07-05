import { useState, useEffect } from 'react'
import { fetchSensorHistory } from '../api/floodData.js'

export default function SensorCard({ sensor }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [hoveredPoint, setHoveredPoint] = useState(null)

  useEffect(() => {
    if (!sensor?.id) return
    setLoading(true)
    fetchSensorHistory(sensor.id)
      .then(data => setHistory(data.history || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [sensor?.id])

  if (!sensor) return null

  // Determine status color based on 5m average level
  const level = sensor.avg_5m
  const levelColorClass = level > 66 ? 'danger' : level > 33 ? 'warning' : 'safe'
  const levelLabel = level > 66 ? 'flooded, alert' : level > 33 ? 'attention, watch' : 'normal, clear'

  // SVG Chart sizing
  const width = 320
  const height = 90
  const padding = 15

  const maxLevel = Math.max(...history.map(pt => pt.level), 80) // default scale to 80 or max
  const minLevel = 0

  // Convert history data points to SVG coordinates
  const points = history.map((pt, i) => {
    const x = padding + (i * (width - padding * 2)) / (history.length - 1 || 1)
    const y = height - padding - ((pt.level - minLevel) * (height - padding * 2)) / (maxLevel - minLevel || 1)
    return { x, y, ...pt }
  })

  // Create path data for line
  const linePath = points.reduce((path, pt, i) => {
    return path + `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y} `
  }, '')

  // Create closed path data for gradient fill
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : ''

  return (
    <div className="sensor-detail-card">
      <h2 className="sensor-detail-name">{sensor.name}</h2>
      <p className="sensor-detail-address">{sensor.address}</p>
      
      <span className={`sensor-detail-status-badge ${levelColorClass}`}>
        {levelLabel}
      </span>

      {/* Main Thermometer Gauge and Stats Grid */}
      <div className="sensor-detail-grid">
        <div className="thermometer-container" title="Current water depth / sensor fill level">
          <div className="thermometer-threshold" title="Alert Threshold (66%)" />
          <div
            className={`thermometer-fill ${levelColorClass}`}
            style={{ height: `${Math.min(100, Math.max(0, level))}%` }}
          />
        </div>

        <div className="sensor-detail-stats">
          <div className="sensor-detail-live-level">
            <span className={`live-level-val ${levelColorClass}`}>{Math.round(level)}%</span>
            <span className="live-level-label">live fill level</span>
          </div>

          <div className="sensor-avg-row">
            <span className="label">5m avg</span>
            <span className="val">{sensor.avg_5m}%</span>
          </div>
          <div className="sensor-avg-row">
            <span className="label">15m avg</span>
            <span className="val">{sensor.avg_15m}%</span>
          </div>
          <div className="sensor-avg-row">
            <span className="label">12h avg</span>
            <span className="val">{sensor.avg_12h}%</span>
          </div>
          <div className="sensor-avg-row">
            <span className="label">24h avg</span>
            <span className="val">{sensor.avg_24h}%</span>
          </div>
        </div>
      </div>

      {/* History Line Chart */}
      <div className="sensor-detail-trend">
        <h4 className="sensor-detail-trend-title">Trend, last 24h</h4>

        {loading ? (
          <div className="skeleton" style={{ height: 80, width: '100%', borderRadius: 8 }} />
        ) : points.length > 0 ? (
          <div className="sensor-trend-chart-container">
            <svg viewBox={`0 0 ${width} ${height}`} className="sensor-trend-svg">
              <defs>
                <linearGradient id="sensorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1a6e7e" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#1a6e7e" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#f0efec" strokeWidth="1" />
              
              {/* Threshold line at 66% */}
              <line
                x1={padding}
                y1={height - padding - (66 * (height - padding * 2)) / 100}
                x2={width - padding}
                y2={height - padding - (66 * (height - padding * 2)) / 100}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              
              {/* Fill area under the curve */}
              <path d={areaPath} fill="url(#sensorAreaGrad)" />

              {/* Draw the line */}
              <path d={linePath} fill="none" stroke="#1a6e7e" strokeWidth="2" strokeLinecap="round" />

              {/* Draw dots */}
              {points.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredPoint?.time === pt.time ? 4 : 2}
                  className={`chart-dot ${hoveredPoint?.time === pt.time ? 'active' : ''}`}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{
                    fill: hoveredPoint?.time === pt.time ? '#1a6e7e' : '#fff',
                    stroke: '#1a6e7e',
                    strokeWidth: 1.5,
                    cursor: 'pointer',
                    transition: 'r 0.1s ease'
                  }}
                />
              ))}
            </svg>

            {/* Tooltip */}
            {hoveredPoint && (
              <div 
                className="chart-tooltip"
                style={{ 
                  left: `${((hoveredPoint.x - padding) / (width - padding * 2)) * 100}%`,
                  bottom: `${((height - hoveredPoint.y) / height) * 100 + 4}%`
                }}
              >
                <strong>{hoveredPoint.time}</strong>
                <span>Level: {hoveredPoint.level}%</span>
              </div>
            )}
          </div>
        ) : (
          <div className="no-data" style={{ padding: '20px 0', textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
            No history available.
          </div>
        )}
      </div>
    </div>
  )
}
