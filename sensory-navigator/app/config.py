"""Central configuration — dataset IDs, CBD bounds, density bands, SLI defaults."""
import math
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"

# --- Data source: City of Melbourne Open Data (Opendatasoft, CC BY 4.0) ---
ODS_BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"

DS_MINUTE_COUNTS = "pedestrian-counting-system-past-hour-counts-per-minute"
DS_HOURLY_COUNTS = "pedestrian-counting-system-monthly-counts-per-hour"
DS_SENSOR_LOCATIONS = "pedestrian-counting-system-sensor-locations"
DS_LANDMARKS = "landmarks-and-places-of-interest-including-schools-theatres-health-services-spor"
DS_STREET_FURNITURE = "street-furniture-including-bollards-bicycle-rails-bins-drinking-fountains-horse-"
DS_LIVE_MUSIC = "live-music-venues"
DS_BARS_PUBS = "bars-and-pubs-with-patron-capacity"
DS_STREET_LIGHTS = "street-lights-with-emitted-lux-level-council-owned-lights-only"
DS_DEV_ACTIVITY = "development-activity-monitor"
DS_PUBLIC_TOILETS = "public-toilets"

ATTRIBUTION = "Data: City of Melbourne Open Data (CC BY 4.0) · Map: OpenStreetMap contributors (ODbL)"

# --- Spatial scope: Melbourne CBD + immediate fringe (Hoddle Grid + Southbank edge) ---
BBOX = {
    "lat_min": -37.8360,
    "lat_max": -37.7900,
    "lon_min": 144.9300,
    "lon_max": 144.9920,
}

# --- Crowd density bands (people per minute per sensor) — per the DMP ---
DENSITY_LOW_MAX = 50      # 0–50   -> Low
DENSITY_MEDIUM_MAX = 150  # 50–150 -> Medium; 150+ -> High

# --- SLI composition defaults (overridden by the user's sensory profile) ---
DEFAULT_WEIGHTS = {"crowd": 0.5, "noise": 0.3, "light": 0.2}
DEFAULT_THRESHOLD = 60          # SLI 0–100 above which an area counts as "High" for the user

# Route variants: label -> lambda (sensory aversion multiplier in edge cost)
ROUTE_LAMBDAS = {"Fastest": 0.0, "Balanced": 1.0, "Lowest Sensory Load": 3.0}

# --- Congested corridors (US 1.2) ---
# A corridor counts as congested at the DMP's "High" density band (150/min),
# expressed on the engine's 0-1 crowd scale.
CONGESTED_CROWD = 0.67
MIN_CORRIDOR_M = 60       # shorter congested runs are sensor noise, not a corridor
FORECAST_STEP_MIN = 15    # granularity for timing the walk against the profiles
CONDITION_HORIZON_MIN = 180  # how far ahead we will claim a condition still holds

# --- IDW interpolation (sensor readings -> graph edges) ---
IDW_POWER = 2
IDW_RADIUS_M = 350        # beyond this, a sensor contributes nothing to an edge
IDW_MIN_SENSORS = 1       # fewer in radius -> edge falls back to profile/unknown

# Live-data cache
LIVE_CACHE_SECONDS = 300  # 5 minutes

# Sensory-source influence radii (metres) for static load layers
SOURCE_RADIUS_M = {"music_venue": 60, "bar": 60, "construction": 120, "light": 40}

# local equirectangular projection (metres per degree) around the CBD centre
_LAT0 = (BBOX["lat_min"] + BBOX["lat_max"]) / 2
M_PER_DEG_LAT = 111_132.0
M_PER_DEG_LON = 111_320.0 * math.cos(math.radians(_LAT0))
