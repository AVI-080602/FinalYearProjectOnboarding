"""The Sensory Load Index engine + router.

SLI per edge (0–1):
    base   = w_c·crowd + w_n·noise + w_l·light      (user weights, sum to 1)
    SLI    = clip( base + 0.25·construction − 0.15·refuge_relief , 0, 1 )

crowd is the only live term: latest sensor readings spread onto edges via
precomputed IDW weights; profile fallback when live data is stale/absent.

Edge cost for routing:  length · (1 + λ·SLI)
    λ = 0 Fastest · 1 Balanced · 3 Lowest Sensory Load
"""
from datetime import datetime, timedelta

import networkx as nx
import numpy as np
import osmnx as ox
import pandas as pd
from sqlalchemy import text

from .. import config as C
from ..db import engine as db_engine
from ..graph.build_graph import EDGE_SENSORS_PATH, GRAPH_PATH

WALK_M_PER_MIN = 80.0  # ~4.8 km/h

# counts/minute -> 0–1, anchored on the DMP bands (50 / 150 people per minute)
def crowd_norm(counts_per_min: np.ndarray) -> np.ndarray:
    return np.interp(counts_per_min, [0, C.DENSITY_LOW_MAX, C.DENSITY_MEDIUM_MAX, 300],
                     [0.0, 0.33, 0.67, 1.0])


class SensoryEngine:
    def __init__(self) -> None:
        self.G = ox.load_graphml(GRAPH_PATH)
        for _, _, d in self.G.edges(data=True):
            for a in ("noise_load", "light_load", "constr_load", "refuge_relief"):
                d[a] = float(d.get(a, 0.0))
            d["length"] = float(d["length"])
        ew = pd.read_parquet(EDGE_SENSORS_PATH)
        self._edge_sensor_groups = ew.groupby(["u", "v", "k"])
        self._ew = ew
        self.live_asof: datetime | None = None
        self.live_by_sensor: dict[int, float] = {}
        self.data_status = "no data"

    # ---------- live overlay ----------

    def refresh_live(self) -> str:
        """Latest reading per sensor from the DB; falls back to profile if stale."""
        with db_engine.connect() as conn:
            df = pd.read_sql(text("""
                SELECT location_id, sensing_datetime, total_of_directions
                FROM pedestrian_minute_count
                WHERE sensing_datetime = (
                    SELECT MAX(sensing_datetime) FROM pedestrian_minute_count p2
                    WHERE p2.location_id = pedestrian_minute_count.location_id
                )
            """), conn)
        if df.empty:
            self.data_status = "no data"
            return self.data_status
        df["sensing_datetime"] = pd.to_datetime(df["sensing_datetime"])
        self.live_asof = df["sensing_datetime"].max()
        age_min = (datetime.utcnow() - self.live_asof).total_seconds() / 60
        # keep only sensors that reported near the latest timestamp
        fresh = df[df["sensing_datetime"] >= self.live_asof - timedelta(minutes=20)]
        self.live_by_sensor = dict(
            zip(fresh["location_id"].astype(int),
                crowd_norm(fresh["total_of_directions"].fillna(0).values))
        )
        self.data_status = (
            f"live ({int(age_min)} min old, {len(fresh)} sensors)"
            if age_min <= 90 else f"stale snapshot ({int(age_min // 60)} h old)"
        )
        return self.data_status

    def profile_by_sensor(self, when: datetime) -> dict[int, float]:
        """Typical counts/min per sensor for a given weekday+hour (hourly avg / 60)."""
        with db_engine.connect() as conn:
            df = pd.read_sql(text(
                "SELECT location_id, avg_count FROM hourly_profile "
                "WHERE weekday = :w AND hour = :h"
            ), conn, params={"w": when.weekday(), "h": when.hour})
        return dict(zip(df["location_id"].astype(int),
                        crowd_norm(df["avg_count"].values / 60.0)))

    def edge_crowd(self, sensor_vals: dict[int, float]) -> dict[tuple, float]:
        """IDW-weighted sensor values per edge. Edges with no sensor in radius: NaN."""
        if not sensor_vals:
            return {}
        ew = self._ew
        vals = ew["location_id"].map(sensor_vals)
        ok = ew[vals.notna()].assign(val=vals.dropna() * ew.loc[vals.notna(), "idw_weight"])
        agg = ok.groupby(["u", "v", "k"]).agg(num=("val", "sum"), den=("idw_weight", "sum"))
        return dict(zip(agg.index, (agg["num"] / agg["den"]).values))

    # ---------- SLI + routing ----------

    def apply_sli(self, weights: dict[str, float], sensor_vals: dict[int, float]) -> None:
        """Write 'sli' + per-λ 'cost_*' attributes onto every edge."""
        wsum = sum(weights.values()) or 1.0
        wc, wn, wl = (weights.get(k, 0) / wsum for k in ("crowd", "noise", "light"))
        crowd = self.edge_crowd(sensor_vals)
        for u, v, k, d in self.G.edges(keys=True, data=True):
            c = crowd.get((u, v, k))
            d["crowd_known"] = c is not None
            c = 0.0 if c is None else float(c)
            d["crowd_val"] = c
            base = wc * c + wn * d["noise_load"] + wl * d["light_load"]
            sli = base + 0.25 * d["constr_load"] - 0.15 * d["refuge_relief"]
            d["sli"] = float(np.clip(sli, 0.0, 1.0))
            for label, lam in C.ROUTE_LAMBDAS.items():
                d[f"cost_{label}"] = d["length"] * (1.0 + lam * d["sli"])

    def nearest_node(self, lat: float, lon: float) -> int:
        return ox.distance.nearest_nodes(self.G, X=lon, Y=lat)

    def route(self, origin: tuple, dest: tuple, weights: dict[str, float],
              sensor_vals: dict[int, float], threshold: int) -> list[dict]:
        """The one call behind 7 ACs: 3 labelled route variants with scores."""
        self.apply_sli(weights, sensor_vals)
        o = self.nearest_node(*origin)
        t = self.nearest_node(*dest)
        out = []
        for label in C.ROUTE_LAMBDAS:
            try:
                nodes = nx.shortest_path(self.G, o, t, weight=f"cost_{label}")
            except nx.NetworkXNoPath:
                continue
            out.append(self._describe(nodes, label, threshold))
        return out

    def _describe(self, nodes: list[int], label: str, threshold: int) -> dict:
        G = self.G
        length = sli_wsum = crowd = noise = light = constr = 0.0
        n_constr_edges = unknown_len = 0.0
        for u, v in zip(nodes[:-1], nodes[1:]):
            d = min(G[u][v].values(), key=lambda e: e[f"cost_{label}"])
            length += d["length"]
            sli_wsum += d["sli"] * d["length"]
            crowd += d.get("crowd_val", 0.0) * d["length"]
            noise += d["noise_load"] * d["length"]
            light += d["light_load"] * d["length"]
            constr += d["constr_load"] * d["length"]
            if d["constr_load"] > 0.3:
                n_constr_edges += 1
            if not d.get("crowd_known"):
                unknown_len += d["length"]
        sli100 = round(100 * sli_wsum / max(length, 1), 1)
        coords = [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in nodes]
        drivers = sorted([
            ("crowds", crowd), ("noise (venues)", noise),
            ("bright lighting", light), ("construction", constr),
        ], key=lambda t: -t[1])
        return {
            "label": label,
            "nodes": nodes,
            "coords": coords,
            "length_m": round(length),
            "minutes": round(length / WALK_M_PER_MIN),
            "sli": sli100,
            "band": "High" if sli100 >= threshold else "Low",
            "top_driver": drivers[0][0],
            "constr_edges": int(n_constr_edges),
            "coverage_pct": round(100 * (1 - unknown_len / max(length, 1))),
        }

    # ---------- forecast (AC 2.2) ----------

    def forecast_sensor(self, location_id: int, when: datetime, hours: int = 1) -> pd.DataFrame:
        """Profile anchored to the current live reading. Returns per-slot counts/min."""
        with db_engine.connect() as conn:
            prof = pd.read_sql(text(
                "SELECT weekday, hour, avg_count FROM hourly_profile "
                "WHERE location_id = :lid"
            ), conn, params={"lid": location_id})
        rows = []
        anchor = 1.0
        pnow = prof[(prof["weekday"] == when.weekday()) & (prof["hour"] == when.hour)]
        live = self.live_by_sensor.get(location_id)
        if live is not None and not pnow.empty and pnow["avg_count"].iloc[0] > 0:
            # invert crowd_norm approximately: use profile counts scaled by live ratio
            typical = pnow["avg_count"].iloc[0] / 60.0
            live_cpm = np.interp(live, [0, 0.33, 0.67, 1.0], [0, 50, 150, 300])
            anchor = float(np.clip(live_cpm / max(typical, 1e-6), 0.4, 2.5))
        for i in range(hours * 12):  # 5-minute slots
            ts = when + timedelta(minutes=5 * i)
            p = prof[(prof["weekday"] == ts.weekday()) & (prof["hour"] == ts.hour)]
            cpm = (p["avg_count"].iloc[0] / 60.0 if not p.empty else np.nan) * anchor
            rows.append({"time": ts, "counts_per_min": cpm})
        return pd.DataFrame(rows)
