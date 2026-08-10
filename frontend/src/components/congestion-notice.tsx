"use client";

import type { Corridor, Route } from "@/lib/api";
import { CONGESTION_COLOR } from "@/lib/route-colors";

/* US 1.2 / F4: the congested stretches predicted along a route, timed to when
   the walker actually reaches them. A 30-minute walk does not happen in the
   conditions it starts in, so every stretch is stated with its own arrival
   time. Silence is a result too: when nothing is congested, say so plainly. */

function place(c: Corridor): string {
  return c.nearby ? `path near ${c.street}` : c.street;
}

function busyness(c: Corridor): string {
  if (c.level >= 0.9) return "packed";
  if (c.level >= 0.78) return "very busy";
  return "busy";
}

export default function CongestionNotice({ route, departAt }: { route: Route; departAt: string }) {
  const list = route.congestion;

  if (list.length === 0) {
    return (
      <p className="mt-2 rounded-xl bg-eucasoft px-3 py-2 text-sm text-euca">
        <span aria-hidden>●</span> No congested stretches predicted on this route for a {departAt}{" "}
        departure.
      </p>
    );
  }

  const totalSeconds = list.reduce((s, c) => s + c.walk_seconds, 0);
  const exposure =
    totalSeconds < 90 ? "under a minute" : `about ${Math.round(totalSeconds / 60)} min`;

  return (
    <div className="mt-2">
      <p className="text-sm">
        <span className="font-semibold text-clay">
          <span aria-hidden>▲</span> {list.length} congested{" "}
          {list.length === 1 ? "stretch" : "stretches"}
        </span>{" "}
        <span className="text-inksoft">
          · {route.congested_m} m · {exposure} of crowd exposure
        </span>
      </p>

      <ul className="mt-2 space-y-1.5">
        {list.map((c, i) => (
          <li
            key={`${c.street}-${i}`}
            className="flex items-baseline gap-2.5 rounded-lg bg-claysoft/70 px-2.5 py-2 text-sm"
          >
            <span
              aria-hidden
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: CONGESTION_COLOR }}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium capitalize">{place(c)}</span>
              <span className="text-inksoft">
                {" "}
                — {busyness(c)}, about {c.people_per_min} people a minute
              </span>
              <span className="block text-xs text-inksoft">
                {c.eta_min === 0 ? "right at the start" : `about ${c.eta_min} min in`} (around{" "}
                {c.at}) · {c.meters} m
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-inksoft">
        Predicted from live sensor counts and typical crowds for that time of day. Congested means
        more than 150 people a minute.
      </p>
    </div>
  );
}
