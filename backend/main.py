import json
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict, deque
import os

import httpx
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image, ImageChops

from risk_scoring import compute_risk_score, compute_leave_by
from gemini_service import ask_gemini

app = FastAPI(title="Rasta Radar API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create static directories for radar loops
STATIC_DIR = Path(__file__).parent / "static"
RADAR_DIR = STATIC_DIR / "radar"
DOPPLER_DIR = STATIC_DIR / "doppler"
RADAR_DIR.mkdir(parents=True, exist_ok=True)
DOPPLER_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Rolling buffers of last 10 frames
rainfall_buffer = deque(maxlen=10)
doppler_buffer = deque(maxlen=10)

# Frontend public folder for base images
FRONTEND_PUBLIC = Path(__file__).parent.parent / "frontend" / "public"

# Layer caching for clean map background and moving radar overlays
NOWCAST_BG = None
NOWCAST_OVERLAY = None
DOPPLER_BG = None
DOPPLER_OVERLAY = None

def extract_layers(base_img_path, bg_color, threshold=25):
    """
    Splits the base image into a clean static background (replacing colored pixels with bg_color)
    and an overlay containing only the highly saturated colored pixels.
    """
    base_img = Image.open(base_img_path).convert('RGB')
    width, height = base_img.size
    
    clean_bg = Image.new('RGB', (width, height), bg_color)
    overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    
    base_pixels = base_img.load()
    clean_pixels = clean_bg.load()
    overlay_pixels = overlay.load()
    
    for y in range(height):
        for x in range(width):
            r, g, b = base_pixels[x, y]
            max_diff = max(r, g, b) - min(r, g, b)
            
            if max_diff >= threshold:
                overlay_pixels[x, y] = (r, g, b, 255)
                clean_pixels[x, y] = bg_color
            else:
                clean_pixels[x, y] = (r, g, b)
                
    return clean_bg, overlay

def init_buffers():
    global NOWCAST_BG, NOWCAST_OVERLAY, DOPPLER_BG, DOPPLER_OVERLAY
    now = datetime.now(timezone.utc)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now_ist = now.astimezone(ist_tz)
    
    base_nowcast = FRONTEND_PUBLIC / "radar_nowcast.png"
    base_doppler = FRONTEND_PUBLIC / "doppler_radar.png"
    
    # Pre-generate only 1 frame for nowcast
    if base_nowcast.exists():
        try:
            filename = "radar_nowcast_0.png"
            base_nowcast_img = Image.open(base_nowcast)
            base_nowcast_img.save(RADAR_DIR / filename)
            
            dt = now_ist - timedelta(minutes=6)
            rainfall_buffer.append({
                "url": f"http://localhost:8000/static/radar/{filename}",
                "timestamp": dt.isoformat(),
                "filename": filename
            })
        except Exception as e:
            print(f"Error pre-generating nowcast: {e}")
            
    # Pre-generate only 1 frame for doppler
    if base_doppler.exists():
        try:
            filename = "doppler_radar_0.png"
            base_doppler_img = Image.open(base_doppler)
            base_doppler_img.save(DOPPLER_DIR / filename)
            
            dt = now_ist - timedelta(minutes=4)
            doppler_buffer.append({
                "url": f"http://localhost:8000/static/doppler/{filename}",
                "timestamp": dt.isoformat(),
                "filename": filename
            })
        except Exception as e:
            print(f"Error pre-generating doppler: {e}")

# Global counters for simulation
rainfall_counter = 1
doppler_counter = 1

async def update_radar_loop():
    while True:
        # Check every 10 minutes (600 seconds)
        await asyncio.sleep(600)
        
        now = datetime.now(timezone.utc)
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        now_ist = now.astimezone(ist_tz)
        
        if len(rainfall_buffer) > 0:
            item = rainfall_buffer[-1]
            item["timestamp"] = (now_ist - timedelta(minutes=6)).isoformat()
            
        if len(doppler_buffer) > 0:
            item = doppler_buffer[-1]
            item["timestamp"] = (now_ist - timedelta(minutes=4)).isoformat()

@app.on_event("startup")
async def startup_event():
    init_buffers()
    asyncio.create_task(update_radar_loop())

# Load static flood spots
SPOTS_FILE = Path(__file__).parent / "flood_spots.json"
with open(SPOTS_FILE) as f:
    FLOOD_SPOTS: list[dict] = json.load(f)

# Persistent community confirm/deny counts using a JSON file.
REPORTS_FILE = Path(__file__).parent / "community_reports.json"

def load_community_counts() -> dict[str, dict]:
    counts = defaultdict(lambda: {"confirms": 0, "denies": 0})
    if REPORTS_FILE.exists():
        try:
            with open(REPORTS_FILE) as f:
                data = json.load(f)
                for k, v in data.items():
                    counts[k] = {"confirms": v.get("confirms", 0), "denies": v.get("denies", 0)}
        except Exception as e:
            print(f"Error loading community reports: {e}")
    return counts

def save_community_counts(counts: dict[str, dict]):
    try:
        # Convert defaultdict to plain dict to serialize to JSON
        data = {k: v for k, v in counts.items()}
        with open(REPORTS_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving community reports: {e}")

community_counts: dict[str, dict] = load_community_counts()

# BigQuery Client Initialization
bq_client = None
bq_client_attempted = False

def get_bq_client():
    global bq_client, bq_client_attempted
    if bq_client_attempted:
        return bq_client
    bq_client_attempted = True
    try:
        from google.cloud import bigquery
        bq_client = bigquery.Client()
        print("BigQuery client successfully initialized using application default credentials.")
    except Exception as e:
        print(f"Warning: Failed to initialize BigQuery client: {e}")
        bq_client = None
    return bq_client

def init_bigquery_tables():
    client = get_bq_client()
    if not client:
        return
    
    from google.cloud import bigquery
    dataset_id = f"{client.project}.rasta_radar"
    dataset = bigquery.Dataset(dataset_id)
    dataset.location = "US"
    
    try:
        client.get_dataset(dataset_id)
        print(f"Dataset {dataset_id} already exists.")
    except Exception:
        try:
            client.create_dataset(dataset, timeout=30)
            print(f"Created dataset {dataset_id}")
        except Exception as e:
            print(f"Failed to create dataset: {e}")
            return

    # Table 1: flood_spots
    spots_table_id = f"{dataset_id}.flood_spots"
    spots_schema = [
        bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("name", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("lat", "FLOAT", mode="REQUIRED"),
        bigquery.SchemaField("lng", "FLOAT", mode="REQUIRED"),
        bigquery.SchemaField("severity", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("description", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("ward", "STRING", mode="NULLABLE"),
    ]
    spots_table = bigquery.Table(spots_table_id, schema=spots_schema)
    
    table_created = False
    try:
        client.get_table(spots_table_id)
        print(f"Table {spots_table_id} already exists.")
    except Exception:
        try:
            client.create_table(spots_table, timeout=30)
            print(f"Created table {spots_table_id}")
            table_created = True
        except Exception as e:
            print(f"Failed to create table {spots_table_id}: {e}")

    # Seed spots if newly created
    if table_created:
        try:
            with open(SPOTS_FILE) as f:
                spots_data = json.load(f)
            
            rows_to_insert = [
                {
                    "id": s["id"],
                    "name": s["name"],
                    "lat": s["lat"],
                    "lng": s["lng"],
                    "severity": s["historical_severity"],
                    "description": s.get("description", ""),
                    "ward": s.get("ward", "")
                }
                for s in spots_data
            ]
            
            errors = client.insert_rows_json(spots_table_id, rows_to_insert)
            if not errors:
                print(f"Seeded {len(rows_to_insert)} spots into BigQuery.")
            else:
                print(f"Errors seeding spots: {errors}")
        except Exception as e:
            print(f"Failed to seed spots table: {e}")

    # Table 2: community_reports
    reports_table_id = f"{dataset_id}.community_reports"
    reports_schema = [
        bigquery.SchemaField("spot_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("confirms", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("denies", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("last_updated", "TIMESTAMP", mode="REQUIRED"),
    ]
    reports_table = bigquery.Table(reports_table_id, schema=reports_schema)
    
    try:
        client.get_table(reports_table_id)
        print(f"Table {reports_table_id} already exists.")
    except Exception:
        try:
            client.create_table(reports_table, timeout=30)
            print(f"Created table {reports_table_id}")
        except Exception as e:
            print(f"Failed to create table {reports_table_id}: {e}")

import time
cached_spots = None
last_spots_fetch_time = 0
db_initialized = False

def ensure_db_initialized():
    global db_initialized
    if db_initialized:
        return
    db_initialized = True
    try:
        import threading
        t = threading.Thread(target=init_bigquery_tables, daemon=True)
        t.start()
        print("Lazy BigQuery database check scheduled in background thread.")
    except Exception as e:
        print(f"Error launching lazy DB initializer thread: {e}")

def db_get_spots():
    global cached_spots, last_spots_fetch_time
    ensure_db_initialized()
    now = time.time()
    if cached_spots and (now - last_spots_fetch_time < 10):
        return cached_spots
        
    client = get_bq_client()
    if not client:
        return get_local_spots()
        
    try:
        query = f"""
            SELECT s.id, s.name, s.lat, s.lng, s.severity as historical_severity, s.description, s.ward,
                   r.status, COALESCE(r.confirms, 0) as confirms, COALESCE(r.denies, 0) as denies
            FROM `{client.project}.rasta_radar.flood_spots` s
            LEFT JOIN `{client.project}.rasta_radar.community_reports` r ON s.id = r.spot_id
        """
        query_job = client.query(query)
        rows = list(query_job.result())
        
        spots = []
        for row in rows:
            spots.append({
                "id": row.id,
                "name": row.name,
                "lat": row.lat,
                "lng": row.lng,
                "historical_severity": row.historical_severity,
                "description": row.description or "",
                "ward": row.ward or "",
                "community": {
                    "confirms": row.confirms,
                    "denies": row.denies
                }
            })
        cached_spots = spots
        last_spots_fetch_time = now
        return spots
    except Exception as e:
        print(f"Error fetching from BigQuery, falling back to local: {e}")
        return get_local_spots()

def get_local_spots():
    res = []
    for s in FLOOD_SPOTS:
        counts = community_counts[s["id"]]
        res.append({
            **s,
            "historical_severity": s["historical_severity"],
            "community": dict(counts)
        })
    return res

def db_update_report(spot_id: str, is_confirm: bool):
    global cached_spots
    ensure_db_initialized()
    cached_spots = None
    
    confirm_delta = 1 if is_confirm else 0
    deny_delta = 0 if is_confirm else 1
    status = "flooded" if is_confirm else "clear"
    
    if is_confirm:
        community_counts[spot_id]["confirms"] += 1
    else:
        community_counts[spot_id]["denies"] += 1
    save_community_counts(community_counts)
    
    client = get_bq_client()
    if not client:
        return {
            "confirms": community_counts[spot_id]["confirms"],
            "denies": community_counts[spot_id]["denies"]
        }
        
    try:
        query = f"""
            MERGE `{client.project}.rasta_radar.community_reports` T
            USING (SELECT '{spot_id}' as spot_id) S
            ON T.spot_id = S.spot_id
            WHEN MATCHED THEN
              UPDATE SET T.confirms = T.confirms + {confirm_delta}, 
                         T.denies = T.denies + {deny_delta}, 
                         T.status = '{status}',
                         T.last_updated = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN
              INSERT (spot_id, status, confirms, denies, last_updated)
              VALUES ('{spot_id}', '{status}', {confirm_delta}, {deny_delta}, CURRENT_TIMESTAMP())
        """
        query_job = client.query(query)
        query_job.result()
        
        select_query = f"""
            SELECT confirms, denies 
            FROM `{client.project}.rasta_radar.community_reports` 
            WHERE spot_id = '{spot_id}'
        """
        select_job = client.query(select_query)
        rows = list(select_job.result())
        if rows:
            return {
                "confirms": rows[0].confirms,
                "denies": rows[0].denies
            }
    except Exception as e:
        print(f"Error merging/updating BigQuery report: {e}")
        
    return {
        "confirms": community_counts[spot_id]["confirms"],
        "denies": community_counts[spot_id]["denies"]
    }

def db_get_community_alerts():
    ensure_db_initialized()
    client = get_bq_client()
    if not client:
        return get_local_community_alerts()
        
    try:
        query = f"""
            SELECT spot_id, status, confirms, denies
            FROM `{client.project}.rasta_radar.community_reports`
            WHERE confirms > 0
        """
        query_job = client.query(query)
        rows = list(query_job.result())
        
        alerts = []
        for row in rows:
            spot = next((s for s in FLOOD_SPOTS if s["id"] == row.spot_id), None)
            if spot:
                alerts.append({
                    "id": row.spot_id,
                    "name": spot["name"],
                    "area": spot["area"],
                    "confirms": row.confirms,
                    "denies": row.denies
                })
        return alerts
    except Exception as e:
        print(f"Error fetching community alerts from BigQuery: {e}")
        return get_local_community_alerts()

def get_local_community_alerts():
    alerts = []
    for spot_id, counts in community_counts.items():
        if counts.get("confirms", 0) > 0:
            spot = next((s for s in FLOOD_SPOTS if s["id"] == spot_id), None)
            if spot:
                alerts.append({
                    "id": spot_id,
                    "name": spot["name"],
                    "area": spot["area"],
                    "confirms": counts["confirms"],
                    "denies": counts["denies"]
                })
    return alerts

# Named routes: each maps to a list of spot IDs that route passes through.
ROUTES = {
    "western_highway": {
        "label": "Western Express Highway",
        "description": "Dahisar to Bandra via WEH; major north-south arterial",
    },
    "eastern_express": {
        "label": "Eastern Express Highway",
        "description": "Mulund to Sion via EEH; connects suburbs to city",
    },
    "dadar_sion": {
        "label": "Dadar–Sion Corridor",
        "description": "Central spine through Dadar, Matunga, Sion",
    },
    "harbour_belt": {
        "label": "Harbour Belt Road",
        "description": "Coastal road from Colaba to Mankhurd via Wadala",
    },
    "andheri_santacruz": {
        "label": "Andheri–Santacruz Link",
        "description": "East-west connectors through Andheri and Santacruz",
    },
    "thane_mulund": {
        "label": "Thane–Mulund Corridor",
        "description": "LBS Marg / Ghodbunder Road through Thane city; connects Mulund to Diva",
    },
    "thane_belapur": {
        "label": "Thane–Belapur Road",
        "description": "Industrial corridor from Thane through Kalwa, Mumbra, Turbhe to CBD Belapur",
    },
    "palm_beach": {
        "label": "Palm Beach Marg (Navi Mumbai)",
        "description": "Vashi to Panvel coastal road; passes Sanpada, Nerul, Belapur, Kharghar",
    },
    "trans_harbour": {
        "label": "Trans-Harbour Link Approach",
        "description": "Airoli bridge approach and Navi Mumbai side connectors via Ghansoli and Turbhe",
    },
    "uran_jnpt": {
        "label": "Uran–JNPT Corridor",
        "description": "Belapur/Uran Phata to Uran city via JNPT Road; heavy container traffic route",
    },
    "ulwe_airport": {
        "label": "Ulwe–Airport Corridor",
        "description": "Belapur/Sion-Panvel Highway to NMIA and Ulwe sectors via Ulwe Node highway",
    },
    "vasai_virar_expressway": {
        "label": "Mumbai–Vasai–Virar Corridor",
        "description": "Borivali/Dahisar through Mira Road, Bhayandar, Naigaon, Vasai, Nallasopara to Virar West",
    },
}


# Open-Meteo: hourly precipitation for Mumbai (lat 19.076, lng 72.877)
OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=19.076&longitude=72.877"
    "&hourly=precipitation"
    "&timezone=Asia%2FKolkata"
    "&forecast_days=2"
)


async def fetch_rainfall_data() -> dict:
    """Fetch hourly precipitation from Open-Meteo. Returns times and precipitation lists."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(OPEN_METEO_URL)
        resp.raise_for_status()
        return resp.json()


def get_rainfall_3h(hourly: dict, target_hour_utc: datetime) -> float:
    """
    Sum precipitation over the 3 hours ending at target_hour_utc.
    Open-Meteo returns hourly data in IST (UTC+5:30).
    """
    times = hourly["time"]  # ISO strings like "2025-06-15T14:00"
    precip = hourly["precipitation"]

    # Find index of target hour in the list
    target_str = target_hour_utc.astimezone(
        timezone(timedelta(hours=5, minutes=30))
    ).strftime("%Y-%m-%dT%H:00")

    try:
        idx = times.index(target_str)
    except ValueError:
        # If target not found, use the last available index
        idx = len(times) - 1

    # Sum 3 hours ending at idx
    start = max(0, idx - 2)
    return sum(precip[start : idx + 1])


def score_all_spots(rainfall_data: dict, at_time: datetime) -> list[dict]:
    """Score every flood spot and return enriched list."""
    hourly = rainfall_data.get("hourly", {})
    rainfall_3h = get_rainfall_3h(hourly, at_time) if hourly else 0.0

    scored = []
    spots_data = db_get_spots()
    for spot in spots_data:
        risk = compute_risk_score(rainfall_3h, spot["historical_severity"], at_time)
        guidance = compute_leave_by(risk["score"], risk["level"], spot)
        scored.append(
            {
                **spot,
                "risk_score": risk["score"],
                "risk_level": risk["level"],
                "risk_components": risk["components"],
                "leave_by": guidance,
                "scored_at": at_time.isoformat(),
            }
        )

    scored.sort(key=lambda s: s["risk_score"], reverse=True)
    return scored


@app.get("/spots")
async def get_spots():
    """Return all flood spots scored against current conditions."""
    try:
        rainfall_data = await fetch_rainfall_data()
    except Exception:
        # Degrade gracefully — score with zero rainfall if Open-Meteo is unreachable
        rainfall_data = {}

    now = datetime.now(timezone.utc)
    spots = score_all_spots(rainfall_data, now)

    high_count = sum(1 for s in spots if s["risk_level"] == "high")
    moderate_count = sum(1 for s in spots if s["risk_level"] == "moderate")

    # Pull current rainfall from the scored data if available
    current_rainfall = (
        spots[0]["risk_components"]["rainfall_mm_3h"] if spots else 0.0
    )

    return {
        "spots": spots,
        "meta": {
            "scored_at": now.isoformat(),
            "high_risk_count": high_count,
            "moderate_risk_count": moderate_count,
            "current_rainfall_3h_mm": current_rainfall,
            "tide_active": spots[0]["risk_components"]["tide_active"] if spots else False,
            "tide_state": spots[0]["risk_components"]["tide_state"] if spots else "normal",
            "disclaimer": "Risk score = live rainfall + historical flood severity + tide timing. Not a calibrated prediction.",
        },
    }


@app.get("/spots/{spot_id}")
async def get_spot(spot_id: str):
    """Return a single spot with current risk score."""
    spots_data = db_get_spots()
    spot = next((s for s in spots_data if s["id"] == spot_id), None)
    if not spot:
        raise HTTPException(status_code=404, detail="Spot not found")

    try:
        rainfall_data = await fetch_rainfall_data()
    except Exception:
        rainfall_data = {}

    now = datetime.now(timezone.utc)
    hourly = rainfall_data.get("hourly", {})
    rainfall_3h = get_rainfall_3h(hourly, now) if hourly else 0.0

    risk = compute_risk_score(rainfall_3h, spot["historical_severity"], now)
    guidance = compute_leave_by(risk["score"], risk["level"], spot)

    return {
        **spot,
        "risk_score": risk["score"],
        "risk_level": risk["level"],
        "risk_components": risk["components"],
        "leave_by": guidance,
        "scored_at": now.isoformat(),
        "disclaimer": "Risk score = live rainfall + historical flood severity + tide timing. Not a calibrated prediction.",
    }


@app.post("/spots/{spot_id}/confirm")
async def confirm_spot(spot_id: str):
    """Community: mark a spot as currently flooded."""
    spots_data = db_get_spots()
    if not any(s["id"] == spot_id for s in spots_data):
        raise HTTPException(status_code=404, detail="Spot not found")
    updated_counts = db_update_report(spot_id, is_confirm=True)
    return {"status": "ok", "community": updated_counts}


@app.post("/spots/{spot_id}/deny")
async def deny_spot(spot_id: str):
    """Community: mark a spot as currently clear."""
    spots_data = db_get_spots()
    if not any(s["id"] == spot_id for s in spots_data):
        raise HTTPException(status_code=404, detail="Spot not found")
    updated_counts = db_update_report(spot_id, is_confirm=False)
    return {"status": "ok", "community": updated_counts}


@app.get("/debug")
async def get_debug_info():
    import sys
    import os
    import traceback
    
    bq_import_status = "OK"
    bq_import_error = None
    try:
        from google.cloud import bigquery
    except Exception as e:
        bq_import_status = "FAILED"
        bq_import_error = f"{str(e)}\n{traceback.format_exc()}"
        
    safe_env = {}
    for k, v in os.environ.items():
        if any(sec in k.lower() for sec in ["key", "secret", "password", "token", "auth", "credentials"]):
            safe_env[k] = "[REDACTED]"
        else:
            safe_env[k] = v

    return {
        "python_version": sys.version,
        "env": safe_env,
        "bq_import_status": bq_import_status,
        "bq_import_error": bq_import_error,
        "current_working_dir": os.getcwd(),
        "files_in_dir": os.listdir(".")
    }



@app.get("/forecast")
async def get_forecast(hour_offset: int = 0):
    """
    Return spots scored against forecast conditions at now + hour_offset hours.
    hour_offset: 0 = current, 1-6 = next 1-6 hours.
    """
    if hour_offset < 0 or hour_offset > 6:
        raise HTTPException(status_code=400, detail="hour_offset must be 0-6")

    try:
        rainfall_data = await fetch_rainfall_data()
    except Exception:
        rainfall_data = {}

    target_time = datetime.now(timezone.utc) + timedelta(hours=hour_offset)
    spots = score_all_spots(rainfall_data, target_time)

    high_count = sum(1 for s in spots if s["risk_level"] == "high")
    current_rainfall = spots[0]["risk_components"]["rainfall_mm_3h"] if spots else 0.0

    return {
        "spots": spots,
        "meta": {
            "forecast_for": target_time.isoformat(),
            "hour_offset": hour_offset,
            "high_risk_count": high_count,
            "current_rainfall_3h_mm": current_rainfall,
            "tide_active": spots[0]["risk_components"]["tide_active"] if spots else False,
            "tide_state": spots[0]["risk_components"]["tide_state"] if spots else "normal",
            "disclaimer": "Risk score = live rainfall + historical flood severity + tide timing. Not a calibrated prediction.",
        },
    }


@app.get("/routes")
async def get_routes():
    """Return all named routes with their associated spot IDs."""
    try:
        rainfall_data = await fetch_rainfall_data()
    except Exception:
        rainfall_data = {}

    now = datetime.now(timezone.utc)
    all_spots = score_all_spots(rainfall_data, now)
    spots_by_id = {s["id"]: s for s in all_spots}

    result = []
    for route_id, route_info in ROUTES.items():
        route_spots = [
            spots_by_id[s["id"]]
            for s in FLOOD_SPOTS
            if route_id in s.get("route_tags", []) and s["id"] in spots_by_id
        ]
        route_spots.sort(key=lambda s: s["risk_score"], reverse=True)

        high = sum(1 for s in route_spots if s["risk_level"] == "high")
        moderate = sum(1 for s in route_spots if s["risk_level"] == "moderate")
        avg_score = (
            round(sum(s["risk_score"] for s in route_spots) / len(route_spots), 1)
            if route_spots else 0
        )

        result.append(
            {
                "id": route_id,
                **route_info,
                "spot_count": len(route_spots),
                "high_risk_spots": high,
                "moderate_risk_spots": moderate,
                "avg_risk_score": avg_score,
                "spots": route_spots,
            }
        )

    return {"routes": result}


class AskRequest(BaseModel):
    question: str


@app.post("/ask")
async def ask(req: AskRequest):
    """NL ask bar: answer user question using current risk data via Gemini."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    try:
        rainfall_data = await fetch_rainfall_data()
    except Exception:
        rainfall_data = {}

    now = datetime.now(timezone.utc)
    spots = score_all_spots(rainfall_data, now)

    # Slim down context for Gemini — only what's needed to answer
    context = [
        {
            "name": s["name"],
            "area": s["area"],
            "risk_level": s["risk_level"],
            "risk_score": s["risk_score"],
            "leave_by": s["leave_by"],
            "rainfall_mm_3h": s["risk_components"]["rainfall_mm_3h"],
        }
        for s in spots
    ]

    answer = await ask_gemini(req.question, context)
    return {"answer": answer}


# --- MOCK DATA FOR NEW ADVANCED FEATURES ---

MOCK_RAINFALL_FORECASTS = {
    "andheri": {
        "daily": [
            {"date": "03 Jul", "observed": 140, "predicted": 130, "category": "Very Heavy Rainfall"},
            {"date": "04 Jul", "observed": 0, "predicted": 150, "category": "Very Heavy Rainfall"},
            {"date": "05 Jul", "observed": 0, "predicted": 180, "category": "Very Heavy Rainfall"},
            {"date": "06 Jul", "observed": 0, "predicted": 210, "category": "Extremely Heavy Rainfall"},
        ],
        "hourly": [
            {"time": "00:00", "rainfall": 12}, {"time": "02:00", "rainfall": 15},
            {"time": "04:00", "rainfall": 28}, {"time": "06:00", "rainfall": 35},
            {"time": "08:00", "rainfall": 42}, {"time": "10:00", "rainfall": 55},
            {"time": "12:00", "rainfall": 48}, {"time": "14:00", "rainfall": 32},
            {"time": "16:00", "rainfall": 22}, {"time": "18:00", "rainfall": 18},
            {"time": "20:00", "rainfall": 15}, {"time": "22:00", "rainfall": 10},
        ]
    },
    "dadar": {
        "daily": [
            {"date": "03 Jul", "observed": 160, "predicted": 150, "category": "Very Heavy Rainfall"},
            {"date": "04 Jul", "observed": 0, "predicted": 170, "category": "Very Heavy Rainfall"},
            {"date": "05 Jul", "observed": 0, "predicted": 210, "category": "Extremely Heavy Rainfall"},
            {"date": "06 Jul", "observed": 0, "predicted": 230, "category": "Extremely Heavy Rainfall"},
        ],
        "hourly": [
            {"time": "00:00", "rainfall": 18}, {"time": "02:00", "rainfall": 22},
            {"time": "04:00", "rainfall": 35}, {"time": "06:00", "rainfall": 48},
            {"time": "08:00", "rainfall": 55}, {"time": "10:00", "rainfall": 62},
            {"time": "12:00", "rainfall": 50}, {"time": "14:00", "rainfall": 38},
            {"time": "16:00", "rainfall": 28}, {"time": "18:00", "rainfall": 20},
            {"time": "20:00", "rainfall": 18}, {"time": "22:00", "rainfall": 12},
        ]
    },
    "thane": {
        "daily": [
            {"date": "03 Jul", "observed": 110, "predicted": 120, "category": "Very Heavy Rainfall"},
            {"date": "04 Jul", "observed": 0, "predicted": 130, "category": "Very Heavy Rainfall"},
            {"date": "05 Jul", "observed": 0, "predicted": 160, "category": "Very Heavy Rainfall"},
            {"date": "06 Jul", "observed": 0, "predicted": 190, "category": "Very Heavy Rainfall"},
        ],
        "hourly": [
            {"time": "00:00", "rainfall": 8}, {"time": "02:00", "rainfall": 12},
            {"time": "04:00", "rainfall": 20}, {"time": "06:00", "rainfall": 28},
            {"time": "08:00", "rainfall": 35}, {"time": "10:00", "rainfall": 42},
            {"time": "12:00", "rainfall": 38}, {"time": "14:00", "rainfall": 25},
            {"time": "16:00", "rainfall": 18}, {"time": "18:00", "rainfall": 15},
            {"time": "20:00", "rainfall": 12}, {"time": "22:00", "rainfall": 8},
        ]
    }
}

# Default fallback for other areas
DEFAULT_RAINFALL = {
    "daily": [
        {"date": "03 Jul", "observed": 95, "predicted": 100, "category": "Heavy Rainfall"},
        {"date": "04 Jul", "observed": 0, "predicted": 120, "category": "Very Heavy Rainfall"},
        {"date": "05 Jul", "observed": 0, "predicted": 140, "category": "Very Heavy Rainfall"},
        {"date": "06 Jul", "observed": 0, "predicted": 160, "category": "Very Heavy Rainfall"},
    ],
    "hourly": [
        {"time": "00:00", "rainfall": 5}, {"time": "02:00", "rainfall": 10},
        {"time": "04:00", "rainfall": 15}, {"time": "06:00", "rainfall": 22},
        {"time": "08:00", "rainfall": 30}, {"time": "10:00", "rainfall": 38},
        {"time": "12:00", "rainfall": 32}, {"time": "14:00", "rainfall": 20},
        {"time": "16:00", "rainfall": 15}, {"time": "18:00", "rainfall": 10},
        {"time": "20:00", "rainfall": 8}, {"time": "22:00", "rainfall": 5},
    ]
}

MOCK_SENSORS = [
    {
        "id": "vakola_nala",
        "name": "Mumbai University Vakola Nala",
        "address": "Mumbai University Gate No.2 Kalina Santacruz East, Kolivery Village, Shanti Nagar, Vakola, Santacruz East, Mumbai, Maharashtra 400098, India",
        "avg_5m": 25,
        "avg_15m": 25,
        "avg_12h": 47,
        "avg_24h": 41,
        "history": [
            {"time": "23:31", "level": 12}, {"time": "01:02", "level": 36}, {"time": "02:31", "level": 32},
            {"time": "04:01", "level": 22}, {"time": "05:31", "level": 42}, {"time": "07:01", "level": 35},
            {"time": "08:32", "level": 58}, {"time": "10:01", "level": 65}, {"time": "11:31", "level": 58},
            {"time": "12:51", "level": 62}, {"time": "14:11", "level": 55}, {"time": "15:35", "level": 50},
            {"time": "17:04", "level": 42}, {"time": "18:32", "level": 32}, {"time": "20:01", "level": 48},
            {"time": "22:04", "level": 25}
        ]
    },
    {
        "id": "dharavi_nallah",
        "name": "Dharavi Sector 3 Nallah",
        "address": "90 Feet Road, near Dharavi Nullah crossing, Dharavi, Mumbai, Maharashtra 400017, India",
        "avg_5m": 42,
        "avg_15m": 45,
        "avg_12h": 68,
        "avg_24h": 55,
        "history": [
            {"time": "23:31", "level": 22}, {"time": "01:02", "level": 46}, {"time": "02:31", "level": 52},
            {"time": "04:01", "level": 38}, {"time": "05:31", "level": 58}, {"time": "07:01", "level": 52},
            {"time": "08:32", "level": 78}, {"time": "10:01", "level": 82}, {"time": "11:31", "level": 74},
            {"time": "12:51", "level": 70}, {"time": "14:11", "level": 64}, {"time": "15:35", "level": 58},
            {"time": "17:04", "level": 48}, {"time": "18:32", "level": 40}, {"time": "20:01", "level": 55},
            {"time": "22:04", "level": 42}
        ]
    },
    {
        "id": "milan_subway_nallah",
        "name": "Milan Subway Drainage Nala",
        "address": "Milan Subway Road, Santacruz West, Mumbai, Maharashtra 400054, India",
        "avg_5m": 15,
        "avg_15m": 18,
        "avg_12h": 38,
        "avg_24h": 32,
        "history": [
            {"time": "23:31", "level": 8}, {"time": "01:02", "level": 25}, {"time": "02:31", "level": 22},
            {"time": "04:01", "level": 15}, {"time": "05:31", "level": 30}, {"time": "07:01", "level": 28},
            {"time": "08:32", "level": 45}, {"time": "10:01", "level": 52}, {"time": "11:31", "level": 42},
            {"time": "12:51", "level": 38}, {"time": "14:11", "level": 35}, {"time": "15:35", "level": 30},
            {"time": "17:04", "level": 22}, {"time": "18:32", "level": 18}, {"time": "20:01", "level": 28},
            {"time": "22:04", "level": 15}
        ]
    },
    {
        "id": "virar_nala",
        "name": "Virar West Highway Drainage",
        "address": "Western Express Hwy Link, near Virar Railway Flyover, Virar West, Palghar, Maharashtra 401303, India",
        "avg_5m": 48,
        "avg_15m": 52,
        "avg_12h": 75,
        "avg_24h": 62,
        "history": [
            {"time": "23:31", "level": 35}, {"time": "01:02", "level": 58}, {"time": "02:31", "level": 60},
            {"time": "04:01", "level": 45}, {"time": "05:31", "level": 65}, {"time": "07:01", "level": 58},
            {"time": "08:32", "level": 82}, {"time": "10:01", "level": 88}, {"time": "11:31", "level": 80},
            {"time": "12:51", "level": 75}, {"time": "14:11", "level": 70}, {"time": "15:35", "level": 64},
            {"time": "17:04", "level": 55}, {"time": "18:32", "level": 48}, {"time": "20:01", "level": 62},
            {"time": "22:04", "level": 48}
        ]
    },
    {
        "id": "borivali_creek",
        "name": "Borivali Gorai Creek Intake",
        "address": "Gorai Creek Jetty Road, Gorai, Borivali West, Mumbai, Maharashtra 400091, India",
        "avg_5m": 65,
        "avg_15m": 70,
        "avg_12h": 92,
        "avg_24h": 85,
        "history": [
            {"time": "23:31", "level": 50}, {"time": "01:02", "level": 72}, {"time": "02:31", "level": 75},
            {"time": "04:01", "level": 62}, {"time": "05:31", "level": 85}, {"time": "07:01", "level": 78},
            {"time": "08:32", "level": 98}, {"time": "10:01", "level": 110}, {"time": "11:31", "level": 98},
            {"time": "12:51", "level": 95}, {"time": "14:11", "level": 88}, {"time": "15:35", "level": 80},
            {"time": "17:04", "level": 72}, {"time": "18:32", "level": 65}, {"time": "20:01", "level": 82},
            {"time": "22:04", "level": 65}
        ]
    },
    {
        "id": "vashi_bridge",
        "name": "Vashi Creek Bridge Channel",
        "address": "Sion-Panvel Highway, Vashi Creek Bridge, Vashi, Navi Mumbai, Maharashtra 400703, India",
        "avg_5m": 32,
        "avg_15m": 35,
        "avg_12h": 55,
        "avg_24h": 48,
        "history": [
            {"time": "23:31", "level": 20}, {"time": "01:02", "level": 40}, {"time": "02:31", "level": 42},
            {"time": "04:01", "level": 30}, {"time": "05:31", "level": 50}, {"time": "07:01", "level": 45},
            {"time": "08:32", "level": 62}, {"time": "10:01", "level": 70}, {"time": "11:31", "level": 65},
            {"time": "12:51", "level": 58}, {"time": "14:11", "level": 52}, {"time": "15:35", "level": 48},
            {"time": "17:04", "level": 40}, {"time": "18:32", "level": 32}, {"time": "20:01", "level": 45},
            {"time": "22:04", "level": 32}
        ]
    },
    {
        "id": "dombivli_nala",
        "name": "Dombivli MIDC Discharge Nallah",
        "address": "Road No. 16, Dombivli Industrial Area, Dombivli East, Thane, Maharashtra 421203, India",
        "avg_5m": 55,
        "avg_15m": 60,
        "avg_12h": 85,
        "avg_24h": 72,
        "history": [
            {"time": "23:31", "level": 40}, {"time": "01:02", "level": 68}, {"time": "02:31", "level": 70},
            {"time": "04:01", "level": 55}, {"time": "05:31", "level": 82}, {"time": "07:01", "level": 72},
            {"time": "08:32", "level": 95}, {"time": "10:01", "level": 105}, {"time": "11:31", "level": 92},
            {"time": "12:51", "level": 88}, {"time": "14:11", "level": 82}, {"time": "15:35", "level": 75},
            {"time": "17:04", "level": 68}, {"time": "18:32", "level": 58}, {"time": "20:01", "level": 74},
            {"time": "22:04", "level": 55}
        ]
    },
    {
        "id": "thane_lake",
        "name": "Thane Masunda Lake Outlet",
        "address": "Dr. Ambedkar Road, near Masunda Lake, Shivaji Nagar, Thane West, Thane, Maharashtra 400601, India",
        "avg_5m": 18,
        "avg_15m": 22,
        "avg_12h": 42,
        "avg_24h": 36,
        "history": [
            {"time": "23:31", "level": 10}, {"time": "01:02", "level": 28}, {"time": "02:31", "level": 25},
            {"time": "04:01", "level": 18}, {"time": "05:31", "level": 36}, {"time": "07:01", "level": 30},
            {"time": "08:32", "level": 50}, {"time": "10:01", "level": 58}, {"time": "11:31", "level": 48},
            {"time": "12:51", "level": 44}, {"time": "14:11", "level": 40}, {"time": "15:35", "level": 36},
            {"time": "17:04", "level": 28}, {"time": "18:32", "level": 22}, {"time": "20:01", "level": 32},
            {"time": "22:04", "level": 18}
        ]
    }
]


@app.get("/api/rainfall/frames")
async def get_rainfall_frames():
    return [
        {
            "url": f"{f['url']}?v={f['timestamp']}",
            "timestamp": f["timestamp"]
        }
        for f in rainfall_buffer
    ]


@app.get("/api/doppler/frames")
async def get_doppler_frames():
    return [
        {
            "url": f"{f['url']}?v={f['timestamp']}",
            "timestamp": f["timestamp"]
        }
        for f in doppler_buffer
    ]


@app.get("/api/rainfall/latest")
async def get_rainfall_latest():
    if not rainfall_buffer:
        raise HTTPException(status_code=404, detail="No frames available")
    f = rainfall_buffer[-1]
    return {
        "url": f"{f['url']}?v={f['timestamp']}",
        "timestamp": f["timestamp"]
    }


@app.get("/api/doppler/latest")
async def get_doppler_latest():
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get("https://api.mumbaiflood.in/aws/radar-gif/")
            r.raise_for_status()
            data = r.json()
            gif_file = data.get("gif_file", "")
            url = f"https://api.mumbaiflood.in/{gif_file.lstrip('/')}"
            return {
                "url": url,
                "timestamp": data.get("timestamp", "")
            }
    except Exception as e:
        if doppler_buffer:
            f = doppler_buffer[-1]
            return {
                "url": f"{f['url']}?v={f['timestamp']}",
                "timestamp": f["timestamp"]
            }
        raise HTTPException(status_code=500, detail=f"Failed to fetch doppler: {e}")


@app.get("/rainfall/{area}")
async def get_rainfall_forecast(area: str):
    key = area.lower().strip()
    return MOCK_RAINFALL_FORECASTS.get(key, DEFAULT_RAINFALL)


@app.get("/sensors")
async def get_sensors():
    return {"sensors": [{"id": s["id"], "name": s["name"], "address": s["address"], "avg_5m": s["avg_5m"], "avg_15m": s["avg_15m"], "avg_12h": s["avg_12h"], "avg_24h": s["avg_24h"]} for s in MOCK_SENSORS]}


@app.get("/sensors/{sensor_id}/history")
async def get_sensor_history(sensor_id: str):
    sensor = next((s for s in MOCK_SENSORS if s["id"] == sensor_id), None)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {"history": sensor["history"]}


@app.get("/api/alerts")
async def get_alerts():
    try:
        rainfall_data = await fetch_rainfall_data()
    except Exception:
        rainfall_data = {}
    now = datetime.now(timezone.utc)
    spots = score_all_spots(rainfall_data, now)
    
    # Filter active warnings (risk level high or moderate)
    hotspots = [
        {
            "id": s["id"],
            "name": s["name"],
            "area": s["area"],
            "risk_score": s["risk_score"],
            "risk_level": s["risk_level"],
            "leave_by": s["leave_by"]
        } for s in spots if s["risk_level"] in ("high", "moderate")
    ]
    
    # Gather community-reported spots (confirms > 0)
    community_alerts = db_get_community_alerts()
                
    # Bulletins mock list from IMD, BMC and Traffic Police
    bulletins = [
        {
            "id": "b1",
            "source": "IMD Regional Meteorological Centre, Mumbai",
            "type": "red_alert",
            "title": "Red Alert: Extremely Heavy Rainfall Warning",
            "content": "Very heavy to extremely heavy rainfall (above 204.4 mm) is expected at isolated places in Mumbai, Thane, and Palghar regions over the next 24 hours. Commuters are advised to restrict travel unless absolutely necessary.",
            "timestamp": now.isoformat()
        },
        {
            "id": "b2",
            "source": "BMC Disaster Management Cell",
            "type": "tide_warning",
            "title": "High Tide Advisory (4.45m)",
            "content": "A high tide of 4.45 meters is expected today at 3:45 PM IST. Heavy rainfall coinciding with high tide increases flooding risks in low-lying zones including Hindmata, Sion, and Milan Subway.",
            "timestamp": (now - timedelta(hours=1)).isoformat()
        },
        {
            "id": "b3",
            "source": "Mumbai Traffic Police Cell",
            "type": "traffic_warning",
            "title": "Traffic Diversions near Andheri Subway",
            "content": "Waterlogging up to 2 feet reported at Andheri Subway. Traffic is temporarily suspended and diverted to SV Road. Expect delays on Western Express Highway southbound lane.",
            "timestamp": (now - timedelta(hours=2)).isoformat()
        }
    ]
    
    return {
        "bulletins": bulletins,
        "hotspots": hotspots,
        "community_alerts": community_alerts,
        "generated_at": now.isoformat()
    }


