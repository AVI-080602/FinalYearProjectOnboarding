"""FastAPI wrapper around the SensoryEngine.

Run:  uvicorn app.api.server:app --port 8000 --reload
The engine (graph + IDW weights) loads once at startup; live pedestrian data
is re-pulled from the DB with a 5-minute cache. No auth anywhere by design.
"""
import math
import time
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select

from .. import config as C
from ..db import CalmPlaceSuggestion, Refuge, SensorLocation, VenueHours, engine as db_engine, init_db, session
from ..sli.engine import SensoryEngine, WALK_M_PER_MIN

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    state["engine"] = SensoryEngine()
    state["live_at"] = 0.0
    _refresh()
    yield


def _refresh() -> str:
    """Refresh live sensor data at most once per LIVE_CACHE_SECONDS."""
    if time.time() - state["live_at"] > C.LIVE_CACHE_SECONDS:
        state["engine"].refresh_live()
        state["live_at"] = time.time()
    return state["engine"].data_status


app = FastAPI(title="Sensory Navigator API", lifespan=lifespan)

# local dev by default; add the deployed frontend via ALLOWED_ORIGINS
# (comma-separated). Vercel preview deploys are matched by the regex.
import os as _os

_origins = [
    o.strip()
    for o in _os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

CATEGORY_OPTIONS = [
    "Art Gallery/Museum", "Church", "Drinking Fountain",
    "Informal Outdoor Facility (Park/Garden/Reserve)", "Library",
    "Picnic Setting", "Public Toilet", "Seat", "Synagogue", "Quiet Laneway", "Other",
]

# naive in-memory rate limit for anonymous suggestions: max 3 per IP per hour
_suggest_log: dict[str, list[float]] = {}


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _in_bbox(lat: float, lon: float) -> bool:
    b = C.BBOX
    return b["lat_min"] <= lat <= b["lat_max"] and b["lon_min"] <= lon <= b["lon_max"]


# ---------- models ----------

class RouteRequest(BaseModel):
    origin: tuple[float, float]           # (lat, lon)
    destination: tuple[float, float]
    weights: dict[str, float] = Field(default_factory=lambda: dict(C.DEFAULT_WEIGHTS))
    threshold: int = C.DEFAULT_THRESHOLD


class SuggestionIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str
    address: str | None = Field(default=None, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    note: str | None = Field(default=None, max_length=300)


# ---------- endpoints ----------

@app.get("/api/status")
def status():
    data_status = _refresh()
    e = state["engine"]
    return {
        "data_status": data_status,
        "live_asof_utc": e.live_asof.isoformat() if e.live_asof else None,
        "sensors_reporting": len(e.live_by_sensor),
        "attribution": C.ATTRIBUTION,
    }


@app.post("/api/routes")
def routes(req: RouteRequest):
    for pt, name in ((req.origin, "origin"), (req.destination, "destination")):
        if not _in_bbox(*pt):
            raise HTTPException(422, f"{name} is outside the Melbourne CBD coverage area")
    _refresh()
    e = state["engine"]
    result = e.route(req.origin, req.destination, req.weights, e.live_by_sensor, req.threshold)
    if not result:
        raise HTTPException(404, "no walkable route found between these points")
    for r in result:
        r.pop("nodes", None)  # internal graph ids, not part of the API contract
    return {"routes": result, "data_status": e.data_status, "attribution": C.ATTRIBUTION}


@app.get("/api/refuges")
def refuges(lat: float, lon: float, tier: int | None = None,
            category: str | None = None, limit: int = 20):
    if not _in_bbox(lat, lon):
        raise HTTPException(422, "location is outside the Melbourne CBD coverage area")
    limit = max(1, min(limit, 100))
    with session() as s:
        q = select(Refuge)
        if tier:
            q = q.where(Refuge.tier == tier)
        if category:
            q = q.where(Refuge.category == category)
        rows = s.scalars(q).all()
        hours_by_refuge: dict[int, list] = {}
        for vh in s.scalars(select(VenueHours)).all():
            hours_by_refuge.setdefault(vh.refuge_id, []).append(
                {"day": vh.day_of_week, "open": vh.open_time, "close": vh.close_time})
    out = []
    for r in rows:
        d = _haversine_m(lat, lon, r.latitude, r.longitude)
        out.append({
            "refuge_id": r.refuge_id, "tier": r.tier, "name": r.name,
            "category": r.category, "latitude": r.latitude, "longitude": r.longitude,
            "wheelchair": r.wheelchair, "distance_m": round(d),
            "walk_minutes": round(d / WALK_M_PER_MIN, 1),
            "hours": hours_by_refuge.get(r.refuge_id) or None,   # None -> "hours unknown"
        })
    out.sort(key=lambda x: x["distance_m"])
    return {"refuges": out[:limit], "total_in_area": len(out), "attribution": C.ATTRIBUTION}


@app.get("/api/forecast/{location_id}")
def forecast(location_id: int, hours: int = 1):
    _refresh()
    hours = max(1, min(hours, 3))
    df = state["engine"].forecast_sensor(location_id, datetime.now(), hours=hours)
    if df["counts_per_min"].isna().all():
        raise HTTPException(404, "no profile data for this sensor")
    slots = [
        {"time": row.time.strftime("%H:%M"),
         "counts_per_min": None if row.counts_per_min != row.counts_per_min
         else round(row.counts_per_min, 1)}
        for row in df.itertuples()
    ]
    return {"location_id": location_id, "slots": slots,
            "bands": {"low_max": C.DENSITY_LOW_MAX, "medium_max": C.DENSITY_MEDIUM_MAX}}


@app.get("/api/sensors")
def sensors():
    _refresh()
    e = state["engine"]
    with session() as s:
        rows = s.scalars(select(SensorLocation).where(SensorLocation.status == "A")).all()
    return {"sensors": [
        {"location_id": r.location_id, "description": r.sensor_description,
         "latitude": r.latitude, "longitude": r.longitude,
         "live_level": round(e.live_by_sensor.get(r.location_id, -1), 3)
         if r.location_id in e.live_by_sensor else None}
        for r in rows
    ]}


@app.post("/api/suggestions", status_code=201)
def create_suggestion(body: SuggestionIn, request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    _suggest_log[ip] = [t for t in _suggest_log.get(ip, []) if now - t < 3600]
    if len(_suggest_log[ip]) >= 3:
        raise HTTPException(429, "suggestion limit reached, try again later")
    if body.category not in CATEGORY_OPTIONS:
        raise HTTPException(422, "unknown category")
    if (body.latitude is None) != (body.longitude is None):
        raise HTTPException(422, "latitude and longitude must be provided together")
    if body.latitude is not None and not _in_bbox(body.latitude, body.longitude):
        raise HTTPException(422, "location is outside the Melbourne CBD coverage area")
    with session() as s:
        row = CalmPlaceSuggestion(
            name=body.name.strip(), category=body.category,
            address=(body.address or "").strip() or None,
            latitude=body.latitude, longitude=body.longitude,
            note=(body.note or "").strip() or None,
            status="pending", created_at=datetime.utcnow(),
        )
        s.add(row)
        s.commit()
        sid = row.suggestion_id
    _suggest_log[ip].append(now)
    return {"suggestion_id": sid, "status": "pending",
            "message": "Saved for review. Nothing is published until a team member approves it."}


_geocode_cache: dict[str, list] = {}


@app.get("/api/geocode")
def geocode(q: str):
    """Search places/addresses near Melbourne CBD via Nominatim (OSM).
    Proxied server-side to respect the usage policy (UA header, caching)."""
    import requests as _rq

    q = q.strip()
    if len(q) < 3:
        raise HTTPException(422, "query too short")
    key = q.lower()
    if key in _geocode_cache:
        return {"results": _geocode_cache[key]}
    r = _rq.get(
        "https://nominatim.openstreetmap.org/search",
        params={
            "q": q, "format": "jsonv2", "limit": 6, "countrycodes": "au",
            "viewbox": f"{C.BBOX['lon_min']},{C.BBOX['lat_max']},{C.BBOX['lon_max']},{C.BBOX['lat_min']}",
            "bounded": 1,
        },
        headers={"User-Agent": "sensory-navigator/0.1 (university accessibility project)"},
        timeout=10,
    )
    r.raise_for_status()
    results = [
        {
            "name": item["display_name"].split(",")[0],
            "detail": ", ".join(item["display_name"].split(",")[1:3]).strip(),
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
        }
        for item in r.json()
    ]
    _geocode_cache[key] = results
    return {"results": results}


@app.get("/api/suggestions")
def list_suggestions(status: str = "pending"):
    with session() as s:
        rows = s.scalars(
            select(CalmPlaceSuggestion).where(CalmPlaceSuggestion.status == status)
        ).all()
    return {"suggestions": [
        {"suggestion_id": r.suggestion_id, "name": r.name, "category": r.category,
         "address": r.address, "latitude": r.latitude, "longitude": r.longitude,
         "note": r.note, "created_at": r.created_at.isoformat()}
        for r in rows
    ]}
