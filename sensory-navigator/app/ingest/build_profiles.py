"""Build the forecast model: typical crowd per sensor x weekday x hour.

Pulls a recent window of the 1.6M-row hourly dataset (server-side filtered),
stores the window in pedestrian_hour_count, and aggregates hourly_profile.

Run daily:  python -m app.ingest.build_profiles
"""
import pandas as pd

from .. import config as C
from ..db import (
    HourlyProfile, PedestrianHourCount, init_db, replace_table, upsert_dataframe,
)
from .client import csv_export, scalar

WINDOW_DAYS = 120


def main() -> None:
    init_db()

    max_date = scalar(C.DS_HOURLY_COUNTS, "max(sensing_date) as m")
    start = (pd.Timestamp(max_date) - pd.Timedelta(days=WINDOW_DAYS)).date()
    print(f"hourly data available to {max_date}; pulling from {start}")

    df = csv_export(
        C.DS_HOURLY_COUNTS,
        where=f"sensing_date >= date'{start}'",
        select="location_id, sensing_date, hourday, direction_1, direction_2, pedestriancount",
    )
    print(f"fetched {len(df)} hourly rows")

    df["sensing_date"] = pd.to_datetime(df["sensing_date"], errors="coerce")
    df = df.dropna(subset=["location_id", "sensing_date", "hourday"])
    df = df.drop_duplicates(["location_id", "sensing_date", "hourday"])

    # --- store the raw window (FK-safe: only sensors we know) ---
    from ..db import SensorLocation, session
    with session() as s:
        known = {row[0] for row in s.query(SensorLocation.location_id).all()}
    df = df[df["location_id"].isin(known)]

    win = pd.DataFrame({
        "location_id": df["location_id"].astype(int),
        "sensing_date": df["sensing_date"].dt.date,
        "hour": df["hourday"].astype(int),
        "direction_1": df["direction_1"],
        "direction_2": df["direction_2"],
        "pedestrian_count": df["pedestriancount"],
    })
    win = win.astype(object).where(pd.notnull(win), None)
    n = upsert_dataframe(win, PedestrianHourCount, ["location_id", "sensing_date", "hour"])
    print(f"pedestrian_hour_count: {n} rows upserted")

    # --- aggregate the profile ---
    df["weekday"] = df["sensing_date"].dt.weekday
    prof = (
        df.groupby(["location_id", "weekday", "hourday"])
        .agg(avg_count=("pedestriancount", "mean"), sample_days=("pedestriancount", "size"))
        .reset_index()
        .rename(columns={"hourday": "hour"})
    )
    prof["location_id"] = prof["location_id"].astype(int)
    prof["weekday"] = prof["weekday"].astype(int)
    prof["hour"] = prof["hour"].astype(int)
    prof["avg_count"] = prof["avg_count"].round(1)
    n = replace_table(prof, HourlyProfile)
    print(f"hourly_profile: {n} rows (sensor x weekday x hour)")


if __name__ == "__main__":
    main()
