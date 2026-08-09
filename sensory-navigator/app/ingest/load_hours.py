"""Load curated venue opening hours from the team spreadsheet into the DB.

Workflow (AC 2.1.2 / 2.1.3 data):
  1. Team fills venue_hours_template.csv (project root) in Excel:
     times as HH:MM 24-hour, blank pair = closed / unknown that day,
     source_url = where the hours were found, verified_date = YYYY-MM-DD.
  2. Run:  python -m app.ingest.load_hours
     Rebuilds the venue_hours table (full refresh) on whichever DB .env points at.
"""
import csv
import re
from datetime import date
from pathlib import Path

from ..config import PROJECT_ROOT
from ..db import VenueHours, init_db, replace_table

import pandas as pd

CSV_PATH = PROJECT_ROOT.parent / "venue_hours_template.csv"
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
TIME_RE = re.compile(r"^([01]?\d|2[0-3]):[0-5]\d$")


def main() -> None:
    init_db()
    if not CSV_PATH.exists():
        raise SystemExit(f"not found: {CSV_PATH}")

    rows, problems, venues_with_hours = [], [], set()
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        for line in csv.DictReader(f):
            rid = int(line["refuge_id"])
            verified = (line.get("verified_date") or "").strip() or None
            source = (line.get("source_url") or "").strip() or None
            for day_idx, day in enumerate(DAYS):
                o = (line.get(f"{day}_open") or "").strip()
                c = (line.get(f"{day}_close") or "").strip()
                if not o and not c:
                    continue  # closed or unknown that day: no row
                if not (TIME_RE.match(o) and TIME_RE.match(c)):
                    problems.append(f"{line['name']} {day}: '{o}'-'{c}' not HH:MM")
                    continue
                rows.append({
                    "refuge_id": rid, "day_of_week": day_idx,
                    "open_time": o, "close_time": c,
                    "source": source, "verified_date": date.fromisoformat(verified) if verified else None,
                })
                venues_with_hours.add(rid)

    if problems:
        print("SKIPPED (fix in the CSV and re-run):")
        for p in problems:
            print("  " + p)
    if not rows:
        raise SystemExit("no valid hour entries found in the CSV yet")

    n = replace_table(pd.DataFrame(rows), VenueHours)
    print(f"venue_hours: {n} rows loaded for {len(venues_with_hours)}/47 venues")


if __name__ == "__main__":
    main()
