import { useState, useEffect } from 'react'
import { fetchSensors } from '../api/floodData.js'
import { Droplet } from 'lucide-react'
import SensorCard from '../components/SensorCard.jsx'

export default function WaterLevel() {
  const [sensors, setSensors] = useState([])
  const [selectedSensorId, setSelectedSensorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState('')

  // Format current date and time dynamically for the header badge
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = months[now.getMonth()]
      const day = String(now.getDate()).padStart(2, '0')
      const year = now.getFullYear()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      setCurrentTime(`${month} ${day}, ${year}   •   ${hours}:${minutes}`)
    }
    updateTime()
    const timer = setInterval(updateTime, 60000)
    return () => clearInterval(timer)
  }, [])

  // Load sensors list on mount
  useEffect(() => {
    setLoading(true)
    fetchSensors()
      .then(data => {
        const list = data.sensors || []
        setSensors(list)
        if (list.length > 0) {
          setSelectedSensorId(list[0].id)
        }
      })
      .catch(() => setError('Could not load water level sensors.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-screen">Loading Sensor Feeds…</div>
  if (error) return <div className="water-level-page"><div className="error-msg">{error}</div></div>

  const selectedSensor = sensors.find(s => s.id === selectedSensorId)

  // Status counts for the summary bar
  const clearCount = sensors.filter(s => s.avg_5m <= 33).length
  const watchCount = sensors.filter(s => s.avg_5m > 33 && s.avg_5m <= 66).length
  const alertCount = sensors.filter(s => s.avg_5m > 66).length

  return (
    <div className="water-level-page">
      <div className="water-level-container">
        
        {/* Header Section */}
        <div className="water-level-header">
          <div>
            <div className="water-level-title-wrap">
              <Droplet className="water-level-icon" size={24} fill="#1a6e7e" />
              <h1 className="water-level-title">Water level</h1>
            </div>
            <p className="water-level-subtitle">
              Near real-time readings from IITB drainage sensors across Mumbai.
            </p>
            <div className="water-level-summary-bar">
              <span className="water-level-summary-item clear">{clearCount} clear</span>
              <span style={{ color: '#ccc', margin: '0 4px' }}>•</span>
              <span className="water-level-summary-item watch">{watchCount} watch</span>
              <span style={{ color: '#ccc', margin: '0 4px' }}>•</span>
              <span className="water-level-summary-item alert">{alertCount} alert</span>
            </div>
          </div>
          <div className="water-level-time-badge">
            <span>{currentTime}</span>
          </div>
        </div>

        {/* Split grid for list and card details */}
        <div className="water-level-grid">
          <div className="sensor-list-column">
            <span className="sensor-list-title">Active sensors</span>
            <div className="sensor-list">
              {sensors.map(s => {
                const level = s.avg_5m
                const levelColorClass = level > 66 ? 'danger' : level > 33 ? 'warning' : 'safe'
                return (
                  <div
                    key={s.id}
                    className={`sensor-list-card ${selectedSensorId === s.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSensorId(s.id)}
                  >
                    <div className="sensor-card-top">
                      <span className="sensor-card-name" title={s.name}>{s.name}</span>
                      <span className={`sensor-card-level-val ${levelColorClass}`}>
                        {Math.round(level)}%
                      </span>
                    </div>
                    <div className="sensor-card-address" title={s.address}>{s.address}</div>
                    <div className="sensor-card-gauge-track">
                      <div
                        className={`sensor-card-gauge-fill ${levelColorClass}`}
                        style={{ width: `${Math.min(100, Math.max(0, level))}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            {selectedSensor ? (
              <SensorCard sensor={selectedSensor} />
            ) : (
              <div className="sensor-detail-card" style={{ textAlign: 'center', color: '#888', padding: '40px 20px' }}>
                Select a sensor from the list to view live details and trend chart.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
