import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'

// Ranked risk card for the dashboard sidebar list.
// Deliberately not the same structure as the SpotDetail stat cards.
export default function RiskCard({ spot, _rank, onLocate }) {
  return (
    <Link to={`/spot/${spot.id}`} className="risk-card">
      <div className={`risk-badge ${spot.risk_level}`}>
        {Math.round(spot.risk_score)}
      </div>
      <div className="risk-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div className="risk-card-name">{spot.name}</div>
          {onLocate && (
            <button
              className="risk-card-locate-btn"
              title="Locate on Map"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onLocate(spot)
              }}
            >
              <MapPin size={14} />
            </button>
          )}
        </div>
        <div className="risk-card-area">{spot.area}</div>
        <div className={`risk-card-guidance ${spot.risk_level === 'high' ? 'high' : ''}`}>
          {spot.leave_by}
        </div>
      </div>
    </Link>
  )
}
