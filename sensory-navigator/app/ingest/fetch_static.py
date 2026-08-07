"""Ingest all static layers -> refuge + sensory_source + sensor_location tables.

Run once per iteration:  python -m app.ingest.fetch_static
"""
import pandas as pd

from .. import config as C
from ..db import (
    Refuge, SensorLocation, SensorySource, init_db, replace_table, upsert_dataframe,
)
from .client import csv_export, scalar


def _in_bbox(df: pd.DataFrame, lat_col: str, lon_col: str) -> pd.DataFrame:
    b = C.BBOX
    return df[
        df[lat_col].between(b["lat_min"], b["lat_max"])
        & df[lon_col].between(b["lon_min"], b["lon_max"])
    ]


def load_sensor_locations() -> int:
    df = csv_export(C.DS_SENSOR_LOCATIONS)
    df = df.rename(columns={"location": "_loc"})
    out = df[[
        "location_id", "sensor_description", "sensor_name", "installation_date",
        "location_type", "status", "direction_1", "direction_2",
        "latitude", "longitude",
    ]].copy()
    out["installation_date"] = pd.to_datetime(out["installation_date"], errors="coerce").dt.date
    out = out.dropna(subset=["latitude", "longitude"]).drop_duplicates("location_id")
    out = out.astype(object).where(pd.notnull(out), None)
    return upsert_dataframe(out, SensorLocation, ["location_id"])


def build_refuges() -> int:
    frames = []

    # --- Tier 1 & 2 + construction sites: landmarks (242 features) ---
    lm = csv_export(C.DS_LANDMARKS)
    # CSV export flattens the geo point as "lat, lon" — handle both orders defensively
    pts = lm["co_ordinates"].str.split(",", expand=True).astype(float)
    lat_first = pts[0].between(-39, -37).all()
    lm["lat"] = pts[0] if lat_first else pts[1]
    lm["lon"] = pts[1] if lat_first else pts[0]

    is_worship = lm["theme"].eq("Place of Worship")
    is_t1 = is_worship | lm["sub_theme"].isin(["Library", "Art Gallery/Museum", "Museum"])
    t1 = lm[is_t1].assign(
        tier=1, category=lm["sub_theme"], name=lm["feature_name"],
        source_dataset=C.DS_LANDMARKS, wheelchair=None,
    )
    frames.append(t1)

    is_t2 = lm["sub_theme"].str.contains("Park/Garden|Playground", case=False, na=False)
    t2 = lm[is_t2].assign(
        tier=2, category=lm["sub_theme"], name=lm["feature_name"],
        source_dataset=C.DS_LANDMARKS, wheelchair=None,
    )
    frames.append(t2)

    # --- Tier 3 micro-refuges: street furniture ---
    sf = csv_export(
        C.DS_STREET_FURNITURE,
        where='asset_type IN ("Seat", "Picnic Setting", "Drinking Fountain")',
    )
    pts = sf["coordinatelocation"].str.split(",", expand=True).astype(float)
    lat_first = pts[0].between(-39, -37).all()
    sf["lat"] = pts[0] if lat_first else pts[1]
    sf["lon"] = pts[1] if lat_first else pts[0]
    t3 = sf.assign(
        tier=3, category=sf["asset_type"],
        name=sf["location_desc"].fillna(sf["asset_type"]).str.slice(0, 200),
        source_dataset=C.DS_STREET_FURNITURE, wheelchair=None,
    )
    frames.append(t3)

    # --- Tier 3: public toilets (with wheelchair flag) ---
    pt = csv_export(C.DS_PUBLIC_TOILETS)
    t3b = pt.assign(
        tier=3, category="Public Toilet", name=pt["name"].str.slice(0, 200),
        source_dataset=C.DS_PUBLIC_TOILETS, wheelchair=pt["wheelchair"],
    )
    frames.append(t3b)

    cols = ["tier", "name", "category", "source_dataset", "lat", "lon", "wheelchair"]
    ref = pd.concat([f[cols] for f in frames], ignore_index=True)
    ref = ref.rename(columns={"lat": "latitude", "lon": "longitude"})
    ref = ref.dropna(subset=["latitude", "longitude"])
    ref = _in_bbox(ref, "latitude", "longitude")
    ref = ref.astype(object).where(pd.notnull(ref), None)
    return replace_table(ref, Refuge)


def build_sensory_sources() -> int:
    frames = []

    # --- noise proxy: live music venues (weight 1.0) ---
    mv = csv_export(C.DS_LIVE_MUSIC)
    frames.append(pd.DataFrame({
        "kind": "music_venue", "name": mv["venue_name"],
        "latitude": mv["lat"], "longitude": mv["lon"], "weight": 1.0,
    }))

    # --- noise proxy: bars/pubs, latest CLUE census year only, patron-scaled ---
    latest = str(scalar(C.DS_BARS_PUBS, "max(census_year) as m"))[:10]
    bars = csv_export(C.DS_BARS_PUBS, where=f"census_year = date'{latest}'")
    frames.append(pd.DataFrame({
        "kind": "bar", "name": bars["trading_name"],
        "latitude": bars["latitude"], "longitude": bars["longitude"],
        "weight": (bars["number_of_patrons"].fillna(50) / 100.0).clip(0.2, 3.0),
    }))

    # --- visual load proxy: street lights, lux in the string field `label` ---
    sl = csv_export(C.DS_STREET_LIGHTS, select="geo_point_2d, label")
    pts = sl["geo_point_2d"].str.split(",", expand=True).astype(float)
    lat_first = pts[0].between(-39, -37).all()
    lux = pd.to_numeric(sl["label"], errors="coerce")
    lights = pd.DataFrame({
        "kind": "light", "name": None,
        "latitude": pts[0] if lat_first else pts[1],
        "longitude": pts[1] if lat_first else pts[0],
        "weight": lux,
    }).dropna(subset=["weight"])
    # only meaningfully bright lights contribute to visual load
    lights = lights[lights["weight"] >= 40]
    frames.append(lights)

    # --- construction: development activity monitor, active sites only ---
    dev = csv_export(C.DS_DEV_ACTIVITY)
    active = dev[dev["status"].str.contains("CONSTRUCTION", case=False, na=False)]
    frames.append(pd.DataFrame({
        "kind": "construction", "name": active["street_address"].str.slice(0, 200),
        "latitude": active["latitude"], "longitude": active["longitude"],
        "weight": (1.0 + active["floors_above"].fillna(0) / 20.0).clip(1.0, 3.0),
    }))

    src = pd.concat(frames, ignore_index=True)
    src = src.dropna(subset=["latitude", "longitude"])
    src = _in_bbox(src, "latitude", "longitude")
    src = src.astype(object).where(pd.notnull(src), None)
    return replace_table(src, SensorySource)


def main() -> None:
    init_db()
    n = load_sensor_locations()
    print(f"sensor_location: {n} rows")
    n = build_refuges()
    print(f"refuge: {n} rows")
    n = build_sensory_sources()
    print(f"sensory_source: {n} rows")


if __name__ == "__main__":
    main()
