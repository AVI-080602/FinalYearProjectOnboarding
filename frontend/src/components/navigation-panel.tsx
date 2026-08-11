"use client";

import { useEffect, useRef } from "react";
import type { Route } from "@/lib/api";
import { CURRENT_ROUTE_COLOR } from "@/lib/route-colors";
import { COMFORT } from "./route-card";
import CongestionNotice from "./congestion-notice";

/* AC 1.2.1: the navigation screen. Once you are walking you are no longer
   comparing, so the comparison affordances go away: no tabs, no swatches, no
   sensory breakdown. What is left is the route you are on, what is coming up,
   and a way out. The route itself is the current route, drawn green. */

export default function NavigationPanel({
  route,
  departAt,
  onExit,
}: {
  route: Route;
  departAt: string;
  onExit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  // moving into a new screen should move the reading position with it
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section
      aria-label="Navigation"
      className="rise-in el-1 overflow-hidden rounded-2xl border border-line bg-card"
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-card"
        style={{ background: CURRENT_ROUTE_COLOR }}
      >
        <div className="min-w-0">
          <h2
            ref={heading}
            tabIndex={-1}
            className="text-sm font-bold uppercase tracking-wide outline-none"
          >
            <span aria-hidden>▸ </span>Navigating
          </h2>
          <p className="mt-0.5 truncate text-sm opacity-95">
            Current route: {COMFORT[route.label].name} · left at {departAt}
          </p>
        </div>
        <button
          onClick={onExit}
          className="shrink-0 rounded-xl bg-card/15 px-3 py-1.5 text-sm font-semibold ring-1 ring-card/40 transition-colors hover:bg-card/25 focus-visible:outline-2 focus-visible:outline-card"
        >
          End
        </button>
      </div>

      <div className="p-4">
        <p className="text-sm">
          <span className="font-display text-3xl font-semibold">{route.minutes}</span>
          <span className="ml-1 text-inksoft">min</span>
          <span className="ml-3 text-inksoft">
            {(route.length_m / 1000).toFixed(1)} km · load {route.sli}/100
          </span>
        </p>

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-inksoft">
          Crowd forecast on the way
        </h3>
        <CongestionNotice route={route} departAt={departAt} />

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-inksoft">
          Directions
        </h3>
        <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
          {route.steps.map((s, i) => (
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
      </div>
    </section>
  );
}
