import { useState, useEffect } from 'react'
import { fetchRainfallForecast } from '../api/floodData.js'
import { CloudRain, Calendar, Clock, AlertTriangle } from 'lucide-react'

export default function RainfallForecastCard({ area }) {
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('hourly') // 'hourly' | 'daily'
  const [hoveredBar, setHoveredBar] = useState(null)

  useEffect(() => {
    if (!area || area === 'All') {
      setForecast(null)
      return
    }

    setLoading(true)
    setError(null)
    fetchRainfallForecast(area)
      .then(setForecast)
      .catch(() => setError('Could not load rainfall forecast.'))
      .finally(() => setLoading(false))
  }, [area])

  if (!area || area === 'All') return null

  if (loading) {
    return (
      <div className="forecast-card loading">
        <div className="skeleton skeleton-title" style={{ width: '60%' }} />
        <div className="skeleton-body" style={{ height: 120, marginTop: 12 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="forecast-card error">
        <div className="error-msg">{error}</div>
      </div>
    )
  }

  if (!forecast) return null

  const hourlyData = forecast.hourly || []
  const dailyData = forecast.daily || []

  // Calculate SVG chart dimensions
  const chartHeight = 100
  const chartWidth = 280
  const maxRain = Math.max(...hourlyData.map(h => h.rainfall), 10) // minimum scale of 10mm

  return (
    <div className="forecast-card">
      <div className="forecast-card-header">
        <div className="forecast-card-title">
          <CloudRain size={16} />
          <h3>Rainfall Forecast: {area}</h3>
        </div>
        <div className="forecast-tabs">
          <button 
            className={`forecast-tab-btn ${activeTab === 'hourly' ? 'active' : ''}`}
            onClick={() => setActiveTab('hourly')}
          >
            <Clock size={12} />
            Hourly
          </button>
          <button 
            className={`forecast-tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            <Calendar size={12} />
            Daily
          </button>
        </div>
      </div>

      <div className="forecast-card-body">
        {activeTab === 'hourly' ? (
          <div className="hourly-forecast-wrap">
            <p className="forecast-subtitle">Expected precipitation in mm (next 24 hours)</p>
            {hourlyData.length > 0 ? (
              <div className="chart-container">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="hourly-svg-chart">
                  {/* Grid Lines */}
                  <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#e5e5e2" strokeWidth="1" />
                  <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#f0efec" strokeDasharray="3 3" />
                  
                  {hourlyData.map((h, index) => {
                    const barWidth = chartWidth / hourlyData.length - 4
                    const x = index * (chartWidth / hourlyData.length) + 2
                    const barHeight = (h.rainfall / maxRain) * (chartHeight - 15)
                    const y = chartHeight - barHeight

                    return (
                      <g key={index} onMouseEnter={() => setHoveredBar({ ...h, x, y })} onMouseLeave={() => setHoveredBar(null)}>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx="2"
                          className={`chart-bar ${hoveredBar?.time === h.time ? 'hovered' : ''}`}
                        />
                        {/* Time labels below bars (every 2nd bar to prevent overlap) */}
                        {index % 2 === 0 && (
                          <text
                            x={x + barWidth / 2}
                            y={chartHeight - 2}
                            textAnchor="middle"
                            className="chart-text"
                          >
                            {h.time}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </svg>

                {/* Tooltip */}
                {hoveredBar && (
                  <div 
                    className="chart-tooltip" 
                    style={{ 
                      left: `${(hoveredBar.x / chartWidth) * 100}%`,
                      bottom: `${((chartHeight - hoveredBar.y) / chartHeight) * 100 + 5}%` 
                    }}
                  >
                    <strong>{hoveredBar.time}</strong>
                    <span>{hoveredBar.rainfall.toFixed(1)} mm</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-data">No hourly forecast data available.</div>
            )}
          </div>
        ) : (
          <div className="daily-forecast-wrap">
            <p className="forecast-subtitle">4-day precipitation overview</p>
            <div className="daily-list">
              {dailyData.map((d, idx) => {
                const isHeavy = d.category.toLowerCase().includes('heavy')
                return (
                  <div key={idx} className="daily-item">
                    <div className="daily-left">
                      <span className="daily-date">{d.date}</span>
                      <span className={`daily-badge ${isHeavy ? 'heavy' : 'light'}`}>
                        {isHeavy && <AlertTriangle size={10} style={{ marginRight: 2 }} />}
                        {d.category}
                      </span>
                    </div>
                    <div className="daily-right">
                      <div className="daily-precip">
                        <span className="label">Predicted</span>
                        <span className="val">{d.predicted}mm</span>
                      </div>
                      {d.observed > 0 && (
                        <div className="daily-precip observed">
                          <span className="label">Observed</span>
                          <span className="val">{d.observed}mm</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
