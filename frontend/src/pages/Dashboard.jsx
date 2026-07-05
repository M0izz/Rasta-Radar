import { useState } from 'react'
import Map from '../components/Map.jsx'
import RiskCard from '../components/RiskCard.jsx'
import AskBar from '../components/AskBar.jsx'
import ForecastSlider from '../components/ForecastSlider.jsx'
import RainfallForecastCard from '../components/RainfallForecastCard.jsx'


export default function Dashboard({ spotsData, _setSpotsData }) {
  const [displayData, setDisplayData] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArea, setSelectedArea] = useState('All')
  const [selectedSpot, setSelectedSpot] = useState(null)

  // Use forecast data if available, fall back to live data
  const activeData = displayData || spotsData
  const isLoading = !activeData

  function handleForecastData(forecastData) {
    setDisplayData(forecastData)
  }

  const spots = activeData?.spots || []
  const meta = activeData?.meta || {}

  const rainfall = meta.current_rainfall_3h_mm ?? 0
  const _tideActive = meta.tide_active ?? false
  const tideState = meta.tide_state ?? 'normal'

  // Derive unique areas from original spotsData (always keep list stable)
  const uniqueAreas = Array.from(
    new Set((spotsData?.spots || []).map(s => s.area).filter(Boolean))
  ).sort()
  const allAreas = ['All', ...uniqueAreas]

  // Filter spots by both searchQuery and selectedArea
  const filteredSpots = spots.filter(spot => {
    const matchesSearch = searchQuery.trim() === '' ||
      spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spot.area.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesArea = selectedArea === 'All' || spot.area === selectedArea
    return matchesSearch && matchesArea
  })

  // Compute risk counts for selected area
  const areaSpots = selectedArea === 'All' ? spots : spots.filter(s => s.area === selectedArea)
  const highCount = areaSpots.filter(s => s.risk_level === 'high').length
  const modCount = areaSpots.filter(s => s.risk_level === 'moderate').length

  // Show matching search results or top 10 if not searching/filtering
  const topSpots = searchQuery.trim() !== '' || selectedArea !== 'All' ? filteredSpots : filteredSpots.slice(0, 10)

  return (
    <div className="dashboard-grid">
      {/* Map column */}
      <div className="dashboard-map-col">
        <div className="stat-strip">
          <div className="stat-item">
            <div className="stat-label">Rainfall (last 3h)</div>
            <div className={`stat-value ${rainfall > 30 ? 'danger' : rainfall > 10 ? 'moderate' : 'safe'}`}>
              {isLoading ? (
                <div className="skeleton" style={{ height: 22, width: 60, marginTop: 4 }} />
              ) : (
                <span>{rainfall.toFixed(1)}<span className="stat-unit">mm</span></span>
              )}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">High-risk spots</div>
            <div className={`stat-value ${highCount > 0 ? 'danger' : 'safe'}`}>
              {isLoading ? (
                <div className="skeleton" style={{ height: 22, width: 30, marginTop: 4 }} />
              ) : (
                highCount
              )}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Moderate spots</div>
            <div className={`stat-value ${modCount > 0 ? 'moderate' : 'safe'}`}>
              {isLoading ? (
                <div className="skeleton" style={{ height: 22, width: 30, marginTop: 4 }} />
              ) : (
                modCount
              )}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Tide state</div>
            <div className={`stat-value ${tideState === 'high' ? 'danger' : tideState === 'low' ? 'safe' : 'normal'}`}>
              {isLoading ? (
                <div className="skeleton" style={{ height: 22, width: 60, marginTop: 4 }} />
              ) : (
                tideState.toUpperCase()
              )}
            </div>
          </div>
        </div>
        <Map
          spots={filteredSpots}
          selectedSpot={selectedSpot}
          onSpotClick={setSelectedSpot}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>

      {/* Sidebar */}
      <div className="dashboard-sidebar">
        <ForecastSlider onForecastData={handleForecastData} disabled={isLoading} />

        <div className="sidebar-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="sidebar-title">Risk ranking</span>
            <span style={{ fontSize: '0.72rem', color: '#aaa' }}>
              {isLoading ? (
                'Loading…'
              ) : searchQuery.trim() !== '' || selectedArea !== 'All' ? (
                `${filteredSpots.length} found`
              ) : (
                'Top 10 ranked'
              )}
            </span>
          </div>
          <select
            className="area-filter-select"
            value={selectedArea}
            onChange={e => {
              setSelectedArea(e.target.value)
              setSelectedSpot(null)
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <option>Loading areas…</option>
            ) : (
              allAreas.map(area => (
                <option key={area} value={area}>{area === 'All' ? 'All Areas' : area}</option>
              ))
            )}
          </select>
        </div>

        {selectedArea !== 'All' && !isLoading && (
          <div style={{ padding: '0 16px', marginTop: 12 }}>
            <RainfallForecastCard area={selectedArea} />
          </div>
        )}

        <div className="spot-list">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-badge" />
                <div className="skeleton-body">
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-subtitle" />
                </div>
              </div>
            ))
          ) : (
            topSpots.map((spot, i) => (
              <RiskCard key={spot.id} spot={spot} rank={i + 1} onLocate={setSelectedSpot} />
            ))
          )}
        </div>

        <AskBar disabled={isLoading} />
      </div>
    </div>
  )
}
