"""Prefill venue_hours_template.csv from OpenStreetMap opening_hours tags.

First pass of the hours curation workflow: OSM often tags libraries, galleries
and churches with opening hours. We match OSM elements to our Tier 1 refuges
by distance + name similarity, parse the common opening_hours patterns, and
write them into the template with source=OpenStreetMap for the team to verify.

Run:  python -m app.ingest.prefill_hours_osm
Then: verify/complete the CSV by hand, and load with python -m app.ingest.load_hours
"""
import csv
import difflib
import math
import re

import requests

from .. import config as C
from ..config import PROJECT_ROOT

CSV_PATH = PROJECT_ROOT.parent / "venue_hours_template.csv"
OVERPASS = "https://overpass-api.de/api/interpreter"
DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
DAY_COLS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
MATCH_RADIUS_M = 90
NAME_SIM_MIN = 0.55

TIME_RANGE = re.compile(r"(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})")


def dist_m(lat1, lon1, lat2, lon2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_day_part(part: str) -> list[int]:
    """'Mo-Fr' -> [0..4]; 'Mo,We' -> [0,2]; '' -> all days. Unknown token -> []."""
    part = part.strip()
    if not part:
        return list(range(7))
    days: list[int] = []
    for token in part.split(","):
        token = token.strip()
        if "-" in token:
            a, b = token.split("-", 1)
            if a.strip() in DAYS and b.strip() in DAYS:
                ia, ib = DAYS.index(a.strip()), DAYS.index(b.strip())
                days += list(range(ia, ib + 1)) if ia <= ib else list(range(ia, 7)) + list(range(0, ib + 1))
            else:
                return []
        elif token in DAYS:
            days.append(DAYS.index(token))
        else:
            return []  # PH, SH, month names: bail on this rule
    return days


def parse_opening_hours(value: str) -> dict[int, tuple[str, str]] | None:
    """Parse common patterns into {weekday: (open, close)}. None if nothing usable.
    Multiple time ranges per day collapse to first-open .. last-close."""
    value = value.strip()
    if value == "24/7":
        return {d: ("00:00", "23:59") for d in range(7)}
    out: dict[int, tuple[str, str]] = {}
    for rule in value.split(";"):
        rule = rule.strip()
        if not rule or "PH" in rule or "SH" in rule or "sunrise" in rule or "sunset" in rule:
            continue
        if rule.lower().endswith("off") or rule.lower().endswith("closed"):
            continue  # leave those days blank
        m = TIME_RANGE.search(rule)
        if not m:
            continue
        day_part = rule[: m.start()].strip().rstrip(":")
        days = parse_day_part(day_part)
        if not days:
            continue
        ranges = TIME_RANGE.findall(rule)
        opens = min(f"{int(h):02d}:{mm}" for h, mm, _, _ in ranges)
        closes = max(f"{int(h):02d}:{mm}" for _, _, h, mm in ranges)
        for d in days:
            out[d] = (opens, closes)
    return out or None


def main() -> None:
    b = C.BBOX
    query = f"""
    [out:json][timeout:90];
    ( node["opening_hours"]({b['lat_min']},{b['lon_min']},{b['lat_max']},{b['lon_max']});
      way["opening_hours"]({b['lat_min']},{b['lon_min']},{b['lat_max']},{b['lon_max']}); );
    out center tags;
    """
    print("querying Overpass for opening_hours tags in the CBD...")
    r = requests.post(
        OVERPASS, data={"data": query}, timeout=120,
        headers={"User-Agent": "sensory-navigator/0.1 (university accessibility project)"},
    )
    r.raise_for_status()
    elements = r.json()["elements"]
    pois = []
    for e in elements:
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        tags = e.get("tags", {})
        if lat and tags.get("opening_hours"):
            pois.append((lat, lon, tags.get("name", ""), tags["opening_hours"]))
    print(f"{len(pois)} OSM elements with opening_hours in the area")

    with open(CSV_PATH, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        venues = list(reader)

    filled = skipped_unparsed = already = 0
    for v in venues:
        if any((v.get(f"{d}_open") or "").strip() for d in DAY_COLS):
            already += 1
            continue  # human already filled this row: never overwrite
        vlat, vlon = None, None
        # template has no coordinates; pull from DB
        from sqlalchemy import select
        from ..db import Refuge, session
        with session() as s:
            ref = s.get(Refuge, int(v["refuge_id"]))
            vlat, vlon = ref.latitude, ref.longitude

        best, best_score = None, 0.0
        vname = v["name"].lower()
        for lat, lon, name, oh in pois:
            d = dist_m(vlat, vlon, lat, lon)
            if d > MATCH_RADIUS_M:
                continue
            sim = difflib.SequenceMatcher(None, vname, name.lower()).ratio() if name else 0.0
            score = sim + max(0.0, (MATCH_RADIUS_M - d) / MATCH_RADIUS_M) * 0.3
            if sim >= NAME_SIM_MIN and score > best_score:
                best, best_score = oh, score
        if not best:
            continue
        hours = parse_opening_hours(best)
        if not hours:
            skipped_unparsed += 1
            continue
        for day_idx, (o, c) in hours.items():
            v[f"{DAY_COLS[day_idx]}_open"] = o
            v[f"{DAY_COLS[day_idx]}_close"] = c
        v["source_url"] = "OpenStreetMap (unverified)"
        filled += 1

    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(venues)

    print(f"prefilled {filled} venues from OSM; {already} already had hours; "
          f"{skipped_unparsed} matched but unparseable; "
          f"{len(venues) - filled - already - skipped_unparsed} still blank for manual research")


if __name__ == "__main__":
    main()
