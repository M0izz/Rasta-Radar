export const BASE = 'http://localhost:8000'

export async function fetchSpots() {
  const res = await fetch(`${BASE}/spots`)
  if (!res.ok) throw new Error('Failed to fetch spots')
  return res.json()
}

export async function fetchSpot(spotId) {
  const res = await fetch(`${BASE}/spots/${spotId}`)
  if (!res.ok) throw new Error('Spot not found')
  return res.json()
}

export async function confirmSpot(spotId) {
  const res = await fetch(`${BASE}/spots/${spotId}/confirm`, {
    method: 'POST'
  })
  if (!res.ok) throw new Error('Failed to confirm')
  return res.json()
}

export async function denySpot(spotId) {
  const res = await fetch(`${BASE}/spots/${spotId}/deny`, {
    method: 'POST'
  })
  if (!res.ok) throw new Error('Failed to deny')
  return res.json()
}

export async function fetchAlerts() {
  const res = await fetch(`${BASE}/api/alerts`)
  if (!res.ok) throw new Error('Failed to fetch alerts')
  return res.json()
}


export async function fetchForecast(hourOffset) {
  const res = await fetch(`${BASE}/forecast?hour_offset=${hourOffset}`)
  if (!res.ok) throw new Error('Failed to fetch forecast')
  return res.json()
}

export async function fetchRoutes() {
  const res = await fetch(`${BASE}/routes`)
  if (!res.ok) throw new Error('Failed to fetch routes')
  return res.json()
}

export async function askQuestion(question) {
  const res = await fetch(`${BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) throw new Error('Ask failed')
  return res.json()
}

export async function fetchRainfallForecast(area) {
  const res = await fetch(`${BASE}/rainfall/${encodeURIComponent(area)}`)
  if (!res.ok) throw new Error('Failed to fetch rainfall forecast')
  return res.json()
}

export async function fetchSensors() {
  const res = await fetch(`${BASE}/sensors`)
  if (!res.ok) throw new Error('Failed to fetch sensors')
  return res.json()
}

export async function fetchSensorHistory(sensorId) {
  const res = await fetch(`${BASE}/sensors/${encodeURIComponent(sensorId)}/history`)
  if (!res.ok) throw new Error('Failed to fetch sensor history')
  return res.json()
}

export async function fetchRainfallFrames() {
  const res = await fetch(`${BASE}/api/rainfall/frames`)
  if (!res.ok) throw new Error('Failed to fetch rainfall frames')
  return res.json()
}

export async function fetchDopplerFrames() {
  const res = await fetch(`${BASE}/api/doppler/frames`)
  if (!res.ok) throw new Error('Failed to fetch doppler frames')
  return res.json()
}

export async function fetchRainfallLatest() {
  const res = await fetch(`${BASE}/api/rainfall/latest`)
  if (!res.ok) throw new Error('Failed to fetch latest rainfall')
  return res.json()
}

export async function fetchDopplerLatest() {
  const res = await fetch(`${BASE}/api/doppler/latest`)
  if (!res.ok) throw new Error('Failed to fetch latest doppler')
  return res.json()
}

