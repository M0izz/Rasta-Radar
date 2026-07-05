# Rasta Radar — Mumbai Waterlogging & Commute Advisory

A hyperlocal tool for Mumbai commuters to check real-time waterlogging risk during monsoon season.

**Not a predictive model** — a transparent heuristic using live rainfall (Open-Meteo), historical flood spot severity, and approximate tide timing.

## Stack

- **Frontend**: React + Vite, plain CSS, Leaflet.js, Lucide icons
- **Backend**: FastAPI (Python), Open-Meteo API, Gemini API

## Run locally

### Backend

```bash
cd backend
pip install -r requirements.txt

# Optional: set Gemini API key for ask bar
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start server
uvicorn main:app --reload
```

Backend runs at http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

## Risk scoring formula

```
risk_score = (rainfall_last_3h_mm × 0.6) + (historical_severity × 0.3 × 20) + (tide_proximity_bonus × 0.1 × 100)
```

- Normalized to 0–100
- Low < 33 / Moderate 33–66 / High > 66
- Tide bonus = 1 if within ±2 hours of Mumbai high tide, else 0

## Data

35 known Mumbai flood-prone spots from BMC ward reports, local news flood coverage 2017–2023, and civic mapping data. See `backend/flood_spots.json`.

## Known limitations

- Tide schedule is approximated from a reference date and period (12h 25m). Not synced with IMD tide tables.
- Community confirm/deny counts reset when the backend restarts (in-memory, no persistence).
- Route comparison is based on labeled associations, not real turn-by-turn routing.
