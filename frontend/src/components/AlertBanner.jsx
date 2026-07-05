import { TriangleAlert } from 'lucide-react'

export default function AlertBanner({ count }) {
  return (
    <div className="alert-banner" role="alert">
      <TriangleAlert size={15} />
      <span>
        <strong>{count} high-risk spot{count > 1 ? 's' : ''}</strong> active right now — check the map before you leave.
      </span>
    </div>
  )
}
