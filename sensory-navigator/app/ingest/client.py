"""Thin client for the City of Melbourne Opendatasoft Explore API v2.1."""
import io

import pandas as pd
import requests

from ..config import ODS_BASE


def csv_export(dataset: str, where: str | None = None, select: str | None = None,
               timeout: int = 600) -> pd.DataFrame:
    """Full-dataset CSV export (no 100-row page cap). Server-side filter via ODSQL."""
    params: dict = {"delimiter": ","}
    if where:
        params["where"] = where
    if select:
        params["select"] = select
    r = requests.get(f"{ODS_BASE}/{dataset}/exports/csv", params=params, timeout=timeout)
    r.raise_for_status()
    return pd.read_csv(io.StringIO(r.text), sep=",", low_memory=False)


def scalar(dataset: str, select: str, timeout: int = 60):
    """Run an ODSQL aggregation (e.g. 'max(sensing_date) as m') and return the value."""
    r = requests.get(
        f"{ODS_BASE}/{dataset}/records",
        params={"select": select, "limit": 1},
        timeout=timeout,
    )
    r.raise_for_status()
    results = r.json().get("results", [])
    if not results:
        return None
    return next(iter(results[0].values()))
