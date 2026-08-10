"use client";

import type { Route } from "@/lib/api";
import { COMFORT, BandChip } from "./route-card";
import CongestionNotice from "./congestion-notice";
import { ROUTE_COLORS } from "@/lib/route-colors";

const FACTORS: {
  key: keyof Route["breakdown"];
  name: string;
  source: string;
}[] = [
  { key: "crowd", name: "Crowds", source: "live sensors" },
  { key: "noise", name: "Noise", source: "venue estimate" },
  { key: "light", name: "Light", source: "lighting estimate" },
  { key: "construction", name: "Construction", source: "active sites" },
];

function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--line)]">
      <div
        className="h-full rounded-full bg-euca transition-[width] duration-300"
        style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

export default function RouteDetail({
  routes,
  current,
  departAt,
  onSwitch,
  onClose,
}: {
  routes: Route[];
  current: Route;
  departAt: string;
  onSwitch: (label: Route["label"]) => void;
  onClose: () => void;
}) {
  const maxFactor = Math.max(...routes.flatMap((r) => Object.values(r.breakdown)), 1);

  return (
    <section
      aria-label={`${COMFORT[current.label].name} route details`}
      className="rise-in rounded-[14px] border border-line bg-card p-4"
    >
      {/* AC 1.1.7: switch between routes without closing */}
      <div className="flex items-center gap-1" role="tablist" aria-label="Route">
        {routes.map((r) => {
          const active = r.label === current.label;
          return (
            <button
              key={r.label}
              role="tab"
              aria-selected={active}
              onClick={() => onSwitch(r.label)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-euca ${
                active ? "text-card" : "text-inksoft hover:bg-mist"
              }`}
              style={active ? { background: ROUTE_COLORS[r.label] } : undefined}
            >
              {COMFORT[r.label].name}
            </button>
          );
        })}
        {/* AC 1.1.6: close */}
        <button
          onClick={onClose}
          aria-label="Close route details"
          className="ml-auto grid h-10 w-10 place-items-center rounded-full text-inksoft hover:bg-mist focus-visible:outline-2 focus-visible:outline-euca"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-sm">
          <span className="font-display text-2xl font-semibold">{current.minutes} min</span>
          <span className="ml-2 text-inksoft">
            {(current.length_m / 1000).toFixed(1)} km · load {current.sli}/100
          </span>
        </p>
        <BandChip band={current.band} />
      </div>

      {/* AC 1.2.1: congested corridors predicted along this route */}
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-inksoft">
        Crowd forecast on the way
      </h3>
      <CongestionNotice route={current} departAt={departAt} />

      {/* AC 1.1.5: what makes this route score what it does */}
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-inksoft">
        Sensory breakdown
      </h3>
      <ul className="mt-2 space-y-2.5">
        {FACTORS.map((f) => (
          <li key={f.key} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
            <span className="text-sm">{f.name}</span>
            <Meter value={current.breakdown[f.key]} max={maxFactor} />
            <span className="text-right text-sm tabular-nums text-inksoft">
              {Math.round(current.breakdown[f.key])}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-inksoft">
        Crowds are measured live; noise and light are estimates from open data.
      </p>

      {/* walking directions: street-by-street from the route graph */}
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-inksoft">
        Directions
      </h3>
      <ol className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
        {current.steps.map((s, i) => (
          <li
            key={`${s.street}-${i}`}
            className="flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-sm odd:bg-mist/60"
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-eucasoft text-[11px] font-bold text-euca">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate capitalize">
              {s.street === "walkway" ? "connecting paths" : s.street}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-inksoft">{s.meters} m</span>
          </li>
        ))}
      </ol>

      {/* honesty row: coverage + confidence, always visible */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-inksoft">
        <span>
          Sensor coverage <span className="font-semibold text-ink">{current.coverage_pct}%</span>
        </span>
        <span>
          Confidence <span className="font-semibold capitalize text-ink">{current.confidence}</span>
        </span>
        <span>
          Construction zones <span className="font-semibold text-ink">{current.constr_edges}</span>
        </span>
      </div>
    </section>
  );
}
