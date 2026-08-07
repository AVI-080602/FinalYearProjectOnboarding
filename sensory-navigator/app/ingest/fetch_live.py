"""Ingest the live minute-level pedestrian counts (rolling window).

Run on demand / every 5 min:  python -m app.ingest.fetch_live
Per the DMP's 2NF fix, sensing_date / sensing_time are NOT stored —
they depend only on sensing_datetime, not the whole composite key.
"""
import pandas as pd

from .. import config as C
from ..db import PedestrianMinuteCount, init_db, upsert_dataframe
from .client import csv_export


def main() -> None:
    init_db()
    df = csv_export(C.DS_MINUTE_COUNTS)
    out = df[["location_id", "sensing_datetime",
              "direction_1", "direction_2", "total_of_directions"]].copy()
    out["sensing_datetime"] = (
        pd.to_datetime(out["sensing_datetime"], utc=True).dt.tz_convert(None)
    )
    out = out.dropna(subset=["location_id", "sensing_datetime"])
    out = out.drop_duplicates(["location_id", "sensing_datetime"])
    out = out.astype(object).where(pd.notnull(out), None)
    n = upsert_dataframe(out, PedestrianMinuteCount, ["location_id", "sensing_datetime"])
    latest = max(r["sensing_datetime"] for r in out.to_dict("records"))
    print(f"pedestrian_minute_count: {n} rows upserted (latest reading {latest} UTC)")


if __name__ == "__main__":
    main()
