"""Compile the walk graph into compact arrays for the runtime engine.

The hosted API must fit in 512 MB; loading the GraphML through osmnx/networkx
does not. This one-off step (run locally after build_graph) flattens
everything routing needs into numpy arrays in one small .npz:

  nodes:  lat/lon
  edges:  CSR adjacency (sorted by source), length, static sensory loads,
          street-name index
  sensors: per-edge IDW weights to pedestrian sensors

Run:  python -m app.graph.compact
"""
import numpy as np
import osmnx as ox
import pandas as pd

from .build_graph import DATA_DIR, EDGE_SENSORS_PATH, GRAPH_PATH

COMPACT_PATH = DATA_DIR / "graph_compact.npz"


def main() -> None:
    G = ox.load_graphml(GRAPH_PATH)
    nodes = list(G.nodes)
    node_idx = {n: i for i, n in enumerate(nodes)}
    lat = np.array([G.nodes[n]["y"] for n in nodes], dtype=np.float64)
    lon = np.array([G.nodes[n]["x"] for n in nodes], dtype=np.float64)

    names: list[str] = []
    name_idx: dict[str, int] = {}
    rows = []
    for u, v, k, d in G.edges(keys=True, data=True):
        name = d.get("name") or "walkway"
        if isinstance(name, list):
            name = name[0]
        if name not in name_idx:
            name_idx[name] = len(names)
            names.append(name)
        rows.append((
            node_idx[u], node_idx[v], u, v, k,
            float(d["length"]),
            float(d.get("noise_load", 0.0)),
            float(d.get("light_load", 0.0)),
            float(d.get("constr_load", 0.0)),
            float(d.get("refuge_relief", 0.0)),
            name_idx[name],
        ))

    # CSR: sort edges by source node index
    rows.sort(key=lambda r: r[0])
    eu = np.array([r[0] for r in rows], dtype=np.int32)
    ev = np.array([r[1] for r in rows], dtype=np.int32)
    elen = np.array([r[5] for r in rows], dtype=np.float32)
    enoise = np.array([r[6] for r in rows], dtype=np.float32)
    elight = np.array([r[7] for r in rows], dtype=np.float32)
    econstr = np.array([r[8] for r in rows], dtype=np.float32)
    erelief = np.array([r[9] for r in rows], dtype=np.float32)
    ename = np.array([r[10] for r in rows], dtype=np.int32)

    indptr = np.zeros(len(nodes) + 1, dtype=np.int64)
    np.add.at(indptr, eu + 1, 1)
    indptr = np.cumsum(indptr)

    # remap the per-edge sensor weights onto the sorted edge order
    key_to_pos = {(r[2], r[3], r[4]): i for i, r in enumerate(rows)}
    ew = pd.read_parquet(EDGE_SENSORS_PATH)
    sens_edge, sens_loc, sens_w = [], [], []
    missed = 0
    for u, v, k, loc, w in ew.itertuples(index=False):
        pos = key_to_pos.get((u, v, k))
        if pos is None:
            missed += 1
            continue
        sens_edge.append(pos)
        sens_loc.append(int(loc))
        sens_w.append(float(w))

    np.savez_compressed(
        COMPACT_PATH,
        node_lat=lat, node_lon=lon,
        edge_u=eu, edge_v=ev, edge_len=elen,
        edge_noise=enoise, edge_light=elight,
        edge_constr=econstr, edge_relief=erelief,
        edge_name=ename, names=np.array(names, dtype=object),
        indptr=indptr,
        sens_edge=np.array(sens_edge, dtype=np.int32),
        sens_loc=np.array(sens_loc, dtype=np.int32),
        sens_w=np.array(sens_w, dtype=np.float32),
    )
    size_mb = COMPACT_PATH.stat().st_size / 1e6
    print(f"graph_compact.npz: {len(nodes)} nodes, {len(rows)} edges, "
          f"{len(sens_edge)} sensor weights ({missed} unmatched), {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
