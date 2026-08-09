"use client";

import Link from "next/link";
import type { Route } from "@/lib/api";
import { COMFORT } from "./route-card";

/* Cards 1.3.7 / 1.3.8: when routes cross the user's threshold, warn once,
   plainly, with a way out and a way through. Never nags after dismissal. */
export default function ThresholdAlert({
  highRoutes,
  threshold,
  calmest,
  onUseCalmest,
  onDismiss,
}: {
  highRoutes: Route[];
  threshold: number;
  calmest: Route | null;
  onUseCalmest: () => void;
  onDismiss: () => void;
}) {
  const worst = highRoutes[0];
  const calmIsOption = calmest && calmest.band === "Low";

  return (
    <div
      role="alert"
      className="rise-in rounded-2xl border border-clay/40 bg-claysoft p-4"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-clay">
        <span aria-hidden>▲</span>
        {highRoutes.length === 1
          ? `The ${COMFORT[worst.label].name} route is above your threshold`
          : `${highRoutes.length} routes are above your threshold`}
      </p>

      {/* the deck's alert fields: trigger, location, distance, expected duration */}
      <ul className="mt-2 space-y-1 text-sm text-ink">
        {highRoutes.map((r) => (
          <li key={r.label}>
            <span className="font-medium">{COMFORT[r.label].name}</span>: load{" "}
            {r.sli} (your limit is {threshold}) · mostly {r.top_driver} · about{" "}
            {(r.length_m / 1000).toFixed(1)} km, {r.minutes} min of exposure
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        {calmIsOption && (
          <button
            onClick={onUseCalmest}
            className="rounded-xl bg-euca px-3.5 py-2 text-sm font-semibold text-card transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-ink"
          >
            Use the Calmest route (load {calmest.sli})
          </button>
        )}
        <button
          onClick={onDismiss}
          className="rounded-xl border border-clay/40 px-3.5 py-2 text-sm font-medium text-clay hover:bg-clay/10 focus-visible:outline-2 focus-visible:outline-clay"
        >
          Continue anyway
        </button>
      </div>
      <p className="mt-2 text-xs text-inksoft">
        Too many warnings?{" "}
        <Link href="/settings" className="underline hover:text-ink">
          Adjust your threshold
        </Link>
        .
      </p>
    </div>
  );
}
