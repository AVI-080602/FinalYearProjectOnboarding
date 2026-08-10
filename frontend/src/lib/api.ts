const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Breakdown = {
  crowd: number;
  noise: number;
  light: number;
  construction: number;
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
  constr_edges: number;
  coverage_pct: number;
  confidence: "high" | "medium" | "low";
  steps: { street: string; meters: number }[];
};

export type RoutesResponse = {
  routes: Route[];
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

export type RouteForecastSlot = {
  time: string;
  sli: number;
  band: "High" | "Low";
  breakdown: Breakdown;
};

export type RouteForecastResponse = {
  route_label: Route["label"];
  threshold: number;
  slots: RouteForecastSlot[];
};

export async function fetchRoutes(
  origin: [number, number],
  destination: [number, number],
  weights: Weights,
  threshold: number
): Promise<RoutesResponse> {
  const res = await fetch(`${BASE}/api/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination, weights, threshold }),
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

export async function fetchRouteForecast(
  origin: [number, number],
  destination: [number, number],
  label: Route["label"],
  weights: Weights,
  threshold: number,
  startTime?: string
): Promise<RouteForecastResponse> {
  const res = await fetch(`${BASE}/api/route-forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin,
      destination,
      label,
      weights,
      threshold,
      start_time: startTime,
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `forecast service error (${res.status})`);
  }

  return res.json();
}
