import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icon path broken by bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const LEVEL_COLOR = {
  high: '#c0392b',
  moderate: '#b7770d',
  low: '#27794f',
}

function makeCircleMarker(spot) {
  const color = LEVEL_COLOR[spot.risk_level] || '#888'
  return L.circleMarker([spot.lat, spot.lng], {
    radius: 7 + (spot.historical_severity - 1) * 1.5,
    fillColor: color,
    color: '#fff',
    weight: 1.5,
    fillOpacity: 0.85,
  })
}

export default function Map({ spots, onSpotClick, selectedSpot, searchQuery, setSearchQuery }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const markersMapRef = useRef({})
  const clusterGroupRef = useRef(null)

  useEffect(() => {
    if (mapInstanceRef.current) return
    mapInstanceRef.current = L.map(mapRef.current, {
      center: [19.076, 72.877],
      zoom: 12,
      zoomControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(mapInstanceRef.current)

    // Initialize marker layer group (replaces markerClusterGroup)
    clusterGroupRef.current = L.layerGroup()
    clusterGroupRef.current.addTo(mapInstanceRef.current)

    // Force Leaflet to recalculate container size after initial render
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    }, 200)
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || !spots || !clusterGroupRef.current) return

    // Ensure map is correctly sized
    mapInstanceRef.current.invalidateSize()

    // Clear existing markers from cluster group
    clusterGroupRef.current.clearLayers()
    markersRef.current = []
    markersMapRef.current = {}

    spots.forEach(spot => {
      const marker = makeCircleMarker(spot)

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; font-size: 13px; min-width: 160px;">
          <strong style="font-size: 14px;">${spot.name}</strong><br/>
          <span style="color: #888; font-size: 12px;">${spot.area}</span><br/>
          <br/>
          <span style="
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            background: ${LEVEL_COLOR[spot.risk_level]};
            color: #fff;
            font-size: 11px;
            font-weight: 600;
          ">${spot.risk_level.toUpperCase()}</span>
          <span style="margin-left: 6px; font-weight: 600; font-size: 13px;">Score: ${Math.round(spot.risk_score)}</span>
          <br/><br/>
          <span style="font-size: 11px; color: #555;">${spot.leave_by}</span>
          <br/><br/>
          <a href="/spot/${spot.id}" style="color: #1a6e7e; font-size: 12px;">View details →</a>
        </div>
      `
      marker.bindPopup(popupContent)
      marker.on('click', () => {
        if (onSpotClick) onSpotClick(spot)
      })

      // Add marker to cluster group
      clusterGroupRef.current.addLayer(marker)

      markersRef.current.push(marker)
      markersMapRef.current[spot.id] = marker
    })
  }, [spots, onSpotClick])

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedSpot) return

    mapInstanceRef.current.setView([selectedSpot.lat, selectedSpot.lng], 15)

    const marker = markersMapRef.current[selectedSpot.id]
    if (marker) {
      marker.openPopup()
    }
  }, [selectedSpot])

  return (
    <div className="map-container">
      <div className="map-search-wrap">
        <input
          type="text"
          className="map-search-input"
          placeholder="Search spot or area..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="map-search-clear" onClick={() => setSearchQuery('')}>
            ×
          </button>
        )}
      </div>
      <div id="leaflet-map" ref={mapRef} style={{ width: '100%', height: '100%' }} />
      <div className="map-disclaimer">
        Risk score = live rainfall + historical flood severity + tide timing. Not a calibrated prediction.
      </div>
    </div>
  )
}
