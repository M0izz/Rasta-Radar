import { useState } from 'react'
import { fetchForecast } from '../api/floodData.js'

// Hour labels relative to "now"
const HOUR_LABELS = ['Now', '+1h', '+2h', '+3h', '+4h', '+5h', '+6h']

export default function ForecastSlider({ onForecastData, disabled }) {
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  async function handleChange(e) {
    const val = parseInt(e.target.value, 10)
    setOffset(val)
    setLoading(true)
    try {
      const data = await fetchForecast(val)
      onForecastData(data)
    } catch {
      // fail silently, keep current data
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="forecast-bar">
      <div className="forecast-bar-label">
        Forecast view — drag to see predicted risk at a future hour
      </div>
      <div className="forecast-controls">
        <input
          className="forecast-slider"
          type="range"
          min="0"
          max="6"
          step="1"
          value={offset}
          onChange={handleChange}
          disabled={loading || disabled}
        />
        <span className="forecast-time-label">
          {loading || disabled ? '…' : HOUR_LABELS[offset]}
        </span>
      </div>
    </div>
  )
}
