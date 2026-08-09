"use client";

import type { Route } from "@/lib/api";
import { ROUTE_COLORS, ROUTE_DASH } from "@/lib/route-colors";

// Comfort labels (AC 1.1.3/1.1.4): friendly names, never colour-alone.
export const COMFORT: Record<
  Route["label"],
  { name: string; hint: string; glyph: string }
> = {
  "Lowest Sensory Load": {
    name: "Calmest",
    hint: "least sensory load",
    glyph: "◗",
  },
  Balanced: { name: "Balanced", hint: "calm and quick", glyph: "◑" },
  Fastest: { name: "Fastest", hint: "shortest time", glyph: "◕" },
};

export function BandChip({ band }: { band: Route["band"] }) {
  const high = band === "High";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        high ? "bg-claysoft text-clay" : "bg-eucasoft text-euca"
      }`}
    >
      <span aria-hidden>{high ? "▲" : "●"}</span>
      {high ? "High load" : "Low load"}
    </span>
  );
}

function Swatch({ label }: { label: Route["label"] }) {
  return (
    <svg width="26" height="6" aria-hidden className="shrink-0">
      <line
        x1="1" y1="3" x2="25" y2="3"
        stroke={ROUTE_COLORS[label]}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={ROUTE_DASH[label]}
      />
    </svg>
  );
}

export default function RouteCard({
  route,
  open,
  onOpen,
  delayMs,
  calmestSli,
  onHover,
  akaNote,
}: {
  route: Route;
  open: boolean;
  onOpen: () => void;
  delayMs: number;
  calmestSli: number;
  onHover: (label: Route["label"] | null) => void;
  akaNote?: string;
}) {
  const c = COMFORT[route.label];
  // comparative framing only when it means something: ratios explode on a
  // near-zero base, so fall back to plain words for tiny differences
  const ratio =
    calmestSli >= 1 && route.sli > calmestSli
      ? Math.round(route.sli / calmestSli)
      : null;
  const compare =
    ratio && ratio >= 2
      ? `about ${ratio}x the load of Calmest`
      : route.sli - calmestSli >= 2
        ? "a bit more load than Calmest"
        : null;
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => onHover(route.label)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(route.label)}
      onBlur={() => onHover(null)}
      aria-expanded={open}
      className={`rise-in w-full rounded-[14px] border bg-card p-4 text-left transition-shadow duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-euca ${
        open ? "border-euca shadow-md" : "border-line"
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex items-center gap-2 font-semibold"
          style={{ color: ROUTE_COLORS[route.label] }}
        >
          <span aria-hidden>{c.glyph}</span>
          {c.name}
          <Swatch label={route.label} />
        </span>
        <BandChip band={route.band} />
      </div>

      <div className="mt-2 flex items-baseline gap-4">
        <span className="font-display text-3xl font-semibold">
          {route.minutes}
          <span className="ml-1 text-base font-normal text-inksoft">min</span>
        </span>
        <span className="text-sm text-inksoft">
          {(route.length_m / 1000).toFixed(1)} km
        </span>
        <span
          className="ml-auto text-sm text-inksoft"
          title="Sensory load, 0 (calm) to 100 (overwhelming)"
        >
          load <span className="font-semibold text-ink">{route.sli}</span>
        </span>
      </div>

      <p className="mt-1.5 text-xs text-inksoft">
        {akaNote ? `${akaNote} · ` : ""}
        {compare ?? c.hint} · mostly {route.top_driver} · details
      </p>
    </button>
  );
}
