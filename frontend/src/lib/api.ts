const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Breakdown = {
  crowd: number;
  noise: number;
  light: number;
  construction: number;
};

// US 1.2: a stretch of the route predicted to be congested when you reach it.
export type Corridor = {
  street: string;
  nearby: boolean; // true = a path beside `street`, not the street itself
  meters: number;
  meters_ahead: number; // distance from the start of the route
  eta_min: number;
  at: string; // clock time you arrive there, "17:42"
  level: number; // 0-1 crowd level
  people_per_min: number;
  walk_seconds: number; // how long you spend walking through it
  lasts_min: number | null; // how long the condition lasts; null = beyond horizon
  until: string | null;
  coords: [number, number][];
};

export type Route = {
  label: "Fastest" | "Balanced" | "Lowest Sensory Load";
  coords: [number, number][];
  length_m: number;
  minutes: number;
  sli: number;
  band: "High" | "Low";
  top_driver: string;
  breakdown: Breakdown;
  congestion: Corridor[];
  congested_m: number;
  recommended: boolean;
  constr_edges: number;
  coverage_pct: number;
  confidence: "high" | "medium" | "low";
  steps: { street: string; meters: number }[];
};

export type RoutesResponse = {
  routes: Route[];
  depart_at: string;
  congested_threshold: { level: number; people_per_min: number };
  data_status: string;
  attribution: string;
};

export type ApiStatus = {
  data_status: string;
  live_asof_utc: string | null;
  sensors_reporting: number;
  attribution: string;
};

export type Weights = { crowd: number; noise: number; light: number };

export async function fetchRoutes(
  origin: [number, number],
  destination: [number, number],
  weights: Weights,
  threshold: number,
  departInMin = 0
): Promise<RoutesResponse> {
  const res = await fetch(`${BASE}/api/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin,
      destination,
      weights,
      threshold,
      depart_in_min: departInMin,
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `route service error (${res.status})`);
  }
  return res.json();
}

export async function fetchStatus(): Promise<ApiStatus> {
  const res = await fetch(`${BASE}/api/status`);
  if (!res.ok) throw new Error("status unavailable");
  return res.json();
}
