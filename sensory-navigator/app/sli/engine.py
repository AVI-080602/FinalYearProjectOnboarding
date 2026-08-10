"""The Sensory Load Index engine + router (compact runtime).

Loads the precompiled graph arrays (app/graph/compact.py) instead of the
GraphML: no osmnx/networkx at runtime, so the hosted API fits in 512 MB.

SLI per edge (0-1):
    base   = w_c*crowd + w_n*noise + w_l*light      (user weights, sum to 1)
    SLI    = clip( base + 0.25*construction - 0.15*refuge_relief , 0, 1 )

crowd is the only live term: latest sensor readings spread onto edges via
precomputed IDW weights; profile fallback when live data is stale/absent.

Edge cost for routing:  length * (1 + lambda*SLI)
    lambda = 0 Fastest, 1 Balanced, 3 Lowest Sensory Load
"""
import heapq
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from sqlalchemy import text

from .. import config as C
from ..config import DATA_DIR, M_PER_DEG_LAT, M_PER_DEG_LON
from ..db import engine as db_engine

COMPACT_PATH = DATA_DIR / "graph_compact.npz"
WALK_M_PER_MIN = 80.0  # ~4.8 km/h


# counts/minute -> 0-1, anchored on the DMP bands (50 / 150 people per minute)
def crowd_norm(counts_per_min: np.ndarray) -> np.ndarray:
    return np.interp(counts_per_min, [0, C.DENSITY_LOW_MAX, C.DENSITY_MEDIUM_MAX, 300],
                     [0.0, 0.33, 0.67, 1.0])


class SensoryEngine:
    def __init__(self) -> None:
        z = np.load(COMPACT_PATH, allow_pickle=True)
        self.lat: np.ndarray = z["node_lat"]
        self.lon: np.ndarray = z["node_lon"]
        self.eu: np.ndarray = z["edge_u"]
        self.ev: np.ndarray = z["edge_v"]
        self.elen: np.ndarray = z["edge_len"].astype(np.float64)
        self.enoise: np.ndarray = z["edge_noise"].astype(np.float64)
        self.elight: np.ndarray = z["edge_light"].astype(np.float64)
        self.econstr: np.ndarray = z["edge_constr"].astype(np.float64)
        self.erelief: np.ndarray = z["edge_relief"].astype(np.float64)
        self.ename: np.ndarray = z["edge_name"]
        self.names: list[str] = list(z["names"])
        self.indptr: np.ndarray = z["indptr"]
        self.sens_edge: np.ndarray = z["sens_edge"]
        self.sens_loc: np.ndarray = z["sens_loc"]
        self.sens_w: np.ndarray = z["sens_w"].astype(np.float64)
        self.n_edges = len(self.eu)

        xy = np.column_stack([self.lon * M_PER_DEG_LON, self.lat * M_PER_DEG_LAT])
        self._node_tree = cKDTree(xy)

        # per-request state
        self._sli: np.ndarray = np.zeros(self.n_edges)
        self._crowd: np.ndarray = np.zeros(self.n_edges)
        self._known: np.ndarray = np.zeros(self.n_edges, dtype=bool)

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

    # ---------- SLI + routing ----------

    def apply_sli(self, weights: dict[str, float], sensor_vals: dict[int, float]) -> None:
        """Vectorised: crowd overlay + personalised SLI for every edge at once."""
        num = np.zeros(self.n_edges)
        den = np.zeros(self.n_edges)
        if sensor_vals:
            v = np.array([sensor_vals.get(int(l), np.nan) for l in self.sens_loc])
            ok = ~np.isnan(v)
            np.add.at(num, self.sens_edge[ok], v[ok] * self.sens_w[ok])
            np.add.at(den, self.sens_edge[ok], self.sens_w[ok])
        self._known = den > 0
        self._crowd = np.where(self._known, num / np.where(den > 0, den, 1.0), 0.0)

        wsum = sum(weights.values()) or 1.0
        wc = weights.get("crowd", 0) / wsum
        wn = weights.get("noise", 0) / wsum
        wl = weights.get("light", 0) / wsum
        base = wc * self._crowd + wn * self.enoise + wl * self.elight
        self._sli = np.clip(base + 0.25 * self.econstr - 0.15 * self.erelief, 0.0, 1.0)

    def nearest_node(self, lat: float, lon: float) -> int:
        _, idx = self._node_tree.query([lon * M_PER_DEG_LON, lat * M_PER_DEG_LAT])
        return int(idx)

    def _dijkstra(self, source: int, target: int, cost: np.ndarray) -> list[int] | None:
        """Returns the list of edge indices along the cheapest path, or None."""
        n = len(self.lat)
        dist = np.full(n, np.inf)
        dist[source] = 0.0
        pred_edge = np.full(n, -1, dtype=np.int64)
        heap = [(0.0, source)]
        indptr, ev = self.indptr, self.ev
        while heap:
            d, u = heapq.heappop(heap)
            if u == target:
                break
            if d > dist[u]:
                continue
            for e in range(indptr[u], indptr[u + 1]):
                v = ev[e]
                nd = d + cost[e]
                if nd < dist[v]:
                    dist[v] = nd
                    pred_edge[v] = e
                    heapq.heappush(heap, (nd, v))
        if not np.isfinite(dist[target]):
            return None
        edges: list[int] = []
        node = target
        while node != source:
            e = int(pred_edge[node])
            if e < 0:
                return None
            edges.append(e)
            node = int(self.eu[e])
        edges.reverse()
        return edges

    def route(self, origin: tuple, dest: tuple, weights: dict[str, float],
              sensor_vals: dict[int, float], threshold: int) -> list[dict]:
        """The one call behind seven ACs: labelled route variants with scores."""
        self.apply_sli(weights, sensor_vals)
        o = self.nearest_node(*origin)
        t = self.nearest_node(*dest)
        out = []
        for label, lam in C.ROUTE_LAMBDAS.items():
            cost = self.elen * (1.0 + lam * self._sli)
            edges = self._dijkstra(o, t, cost)
            if edges is None:
                continue
            out.append(self._describe(edges, label, threshold))
        return out

    def _describe(self, edges: list[int], label: str, threshold: int) -> dict:
        e = np.array(edges, dtype=np.int64)
        L = self.elen[e]
        length = float(L.sum())
        Lsafe = max(length, 1.0)
        sli100 = round(100 * float((self._sli[e] * L).sum()) / Lsafe, 1)
        crowd = float((self._crowd[e] * L).sum())
        noise = float((self.enoise[e] * L).sum())
        light = float((self.elight[e] * L).sum())
        constr = float((self.econstr[e] * L).sum())
        coverage = round(100 * float(L[self._known[e]].sum()) / Lsafe)
        live_fresh = self.data_status.startswith("live")
        confidence = ("high" if coverage >= 70 and live_fresh
                      else "low" if coverage < 30 or not live_fresh else "medium")

        # coords: origin node of each edge, then the final target node
        node_seq = [int(self.eu[edges[0]])] + [int(self.ev[i]) for i in edges]
        coords = [(float(self.lat[n]), float(self.lon[n])) for n in node_seq]

        steps: list[dict] = []
        for i in edges:
            name = self.names[int(self.ename[i])]
            if steps and steps[-1]["street"] == name:
                steps[-1]["meters"] += float(self.elen[i])
            else:
                steps.append({"street": name, "meters": float(self.elen[i])})

        drivers = sorted([
            ("crowds", crowd), ("noise (venues)", noise),
            ("bright lighting", light), ("construction", constr),
        ], key=lambda t: -t[1])
        return {
            "label": label,
            "coords": coords,
            "length_m": round(length),
            "minutes": round(length / WALK_M_PER_MIN),
            "sli": sli100,
            "band": "High" if sli100 >= threshold else "Low",
            "top_driver": drivers[0][0],
            "breakdown": {
                "crowd": round(100 * crowd / Lsafe, 1),
                "noise": round(100 * noise / Lsafe, 1),
                "light": round(100 * light / Lsafe, 1),
                "construction": round(100 * constr / Lsafe, 1),
            },
            "constr_edges": int((self.econstr[e] > 0.3).sum()),
            "coverage_pct": coverage,
            "confidence": confidence,
            "steps": [
                {"street": s["street"], "meters": round(s["meters"])}
                for s in steps
                if s["meters"] >= 25 or s["street"] != "walkway"
            ],
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
            typical = pnow["avg_count"].iloc[0] / 60.0
            live_cpm = np.interp(live, [0, 0.33, 0.67, 1.0], [0, 50, 150, 300])
            anchor = float(np.clip(live_cpm / max(typical, 1e-6), 0.4, 2.5))
        for i in range(hours * 12):  # 5-minute slots
            ts = when + timedelta(minutes=5 * i)
            p = prof[(prof["weekday"] == ts.weekday()) & (prof["hour"] == ts.hour)]
            cpm = (p["avg_count"].iloc[0] / 60.0 if not p.empty else np.nan) * anchor
            rows.append({"time": ts, "counts_per_min": cpm})
        return pd.DataFrame(rows)
