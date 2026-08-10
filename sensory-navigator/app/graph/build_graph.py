"""Build the routable walk graph and bake static sensory layers onto every edge.

One-off (re-run per iteration):  python -m app.graph.build_graph

Outputs (in <project>/data/):
  walk_graph.graphml   — OSM walk network with noise/light/constr/refuge loads per edge
  edge_sensors.parquet — per-edge IDW weights to nearby pedestrian sensors
"""
import math

import numpy as np
import osmnx as ox
import pandas as pd
from scipy.spatial import cKDTree
from sqlalchemy import select

from .. import config as C
from ..config import DATA_DIR, M_PER_DEG_LAT, M_PER_DEG_LON
from ..db import Refuge, SensorLocation, SensorySource, engine

GRAPH_PATH = DATA_DIR / "walk_graph.graphml"
EDGE_SENSORS_PATH = DATA_DIR / "edge_sensors.parquet"


def to_xy(lat, lon):
    return np.column_stack([
        (np.asarray(lon)) * M_PER_DEG_LON,
        (np.asarray(lat)) * M_PER_DEG_LAT,
    ])


def kind_load(edge_xy: np.ndarray, pts: pd.DataFrame, radius: float) -> np.ndarray:
    """Sum of source weights within `radius` m of each edge midpoint, linear falloff."""
    if pts.empty:
        return np.zeros(len(edge_xy))
    tree = cKDTree(to_xy(pts["latitude"].values, pts["longitude"].values))
    load = np.zeros(len(edge_xy))
    pairs = tree.query_ball_point(edge_xy, r=radius)
    w = pts["weight"].values
    for i, idxs in enumerate(pairs):
        if idxs:
            d = np.linalg.norm(tree.data[idxs] - edge_xy[i], axis=1)
            load[i] = float(np.sum(w[idxs] * (1.0 - d / radius)))
    return load


def normalise(x: np.ndarray, p: float = 95) -> np.ndarray:
    """Robust 0–1: clip at the p-th percentile of the non-zero values."""
    nz = x[x > 0]
    if nz.size == 0:
        return np.zeros_like(x)
    hi = np.percentile(nz, p)
    return np.clip(x / max(hi, 1e-9), 0.0, 1.0)


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    b = C.BBOX

    print("downloading OSM walk network…")
    G = ox.graph_from_bbox(
        bbox=(b["lon_min"], b["lat_min"], b["lon_max"], b["lat_max"]),
        network_type="walk", simplify=True, retain_all=False,
    )
    print(f"graph: {len(G.nodes)} nodes, {len(G.edges)} edges")

    # --- edge midpoints ---
    edges = list(G.edges(keys=True))
    mid = np.array([
        [(G.nodes[u]["y"] + G.nodes[v]["y"]) / 2, (G.nodes[u]["x"] + G.nodes[v]["x"]) / 2]
        for u, v, k in edges
    ])
    edge_xy = to_xy(mid[:, 0], mid[:, 1])

    # --- static sensory layers from DB ---
    src = pd.read_sql(select(SensorySource.__table__), engine)
    loads = {}
    for kind, radius in C.SOURCE_RADIUS_M.items():
        pts = src[src["kind"] == kind]
        loads[kind] = kind_load(edge_xy, pts, radius)
        print(f"  {kind}: {len(pts)} sources -> {int((loads[kind] > 0).sum())} edges touched")

    noise = normalise(loads["music_venue"] + loads["bar"])
    light = normalise(loads["light"])
    constr = normalise(loads["construction"])

    # --- refuge relief: proximity of nearest Tier-3 refuge (0–1, 1 = adjacent) ---
    ref = pd.read_sql(select(Refuge.__table__).where(Refuge.__table__.c.tier == 3), engine)
    rtree = cKDTree(to_xy(ref["latitude"].values, ref["longitude"].values))
    dist, _ = rtree.query(edge_xy, k=1)
    relief = np.clip(1.0 - dist / 200.0, 0.0, 1.0)  # fades to 0 at 200 m

    for i, (u, v, k) in enumerate(edges):
        d = G.edges[u, v, k]
        d["noise_load"] = round(float(noise[i]), 4)
        d["light_load"] = round(float(light[i]), 4)
        d["constr_load"] = round(float(constr[i]), 4)
        d["refuge_relief"] = round(float(relief[i]), 4)

    ox.save_graphml(G, GRAPH_PATH)
    print(f"saved {GRAPH_PATH.name}")

    # --- per-edge IDW weights to pedestrian sensors (static part of the live overlay) ---
    sens = pd.read_sql(select(SensorLocation.__table__), engine)
    stree = cKDTree(to_xy(sens["latitude"].values, sens["longitude"].values))
    rows = []
    pairs = stree.query_ball_point(edge_xy, r=C.IDW_RADIUS_M)
    ids = sens["location_id"].values
    for i, idxs in enumerate(pairs):
        if not idxs:
            continue
        u, v, k = edges[i]
        d = np.linalg.norm(stree.data[idxs] - edge_xy[i], axis=1)
        w = 1.0 / np.maximum(d, 10.0) ** C.IDW_POWER
        w = w / w.sum()
        for j, wj in zip(idxs, w):
            rows.append((u, v, k, int(ids[j]), float(wj)))
    ew = pd.DataFrame(rows, columns=["u", "v", "k", "location_id", "idw_weight"])
    ew.to_parquet(EDGE_SENSORS_PATH, index=False)
    covered = ew.groupby(["u", "v", "k"]).ngroups
    print(f"edge_sensors: {len(ew)} pairs; {covered}/{len(edges)} edges within "
          f"{C.IDW_RADIUS_M} m of a sensor")


if __name__ == "__main__":
    main()
