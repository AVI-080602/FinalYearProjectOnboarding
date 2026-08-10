"use client";

import type { Corridor, Route } from "@/lib/api";

/* AC 1.2.2: while following a route, a high-sensory section ahead is called
   out over the map with where it is, how far ahead, and how long it lasts.

   Live region is polite, not assertive, on purpose: an app for sensory-
   sensitive users should not interrupt a screen reader mid-sentence to say
   something the user is still minutes away from. */

function distanceAhead(c: Corridor): string {
  if (c.meters_ahead < 50) return "right ahead";
  if (c.meters_ahead < 1000) return `${c.meters_ahead} m ahead`;
  return `${(c.meters_ahead / 1000).toFixed(1)} km ahead`;
}

function duration(c: Corridor): string {
  if (c.lasts_min === null) return "busy for the next few hours";
  if (c.lasts_min < 30) return `easing by about ${c.until}`;
  const h = Math.floor(c.lasts_min / 60);
  const m = c.lasts_min % 60;
  const span = h > 0 ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  return `busy about ${span} more, easing by ${c.until}`;
}

export default function SensoryWarningBanner({
  route,
  onDismiss,
}: {
  route: Route;
  onDismiss: () => void;
}) {
  const next = route.congestion[0];
  if (!next) return null;
  const more = route.congestion.length - 1;

  return (
    <div
      role="status"
      aria-live="polite"
      /* clears Leaflet's zoom control (top-left, ~44px) and sits above its
         control layer, which is itself z-1000 */
      className="rise-in pointer-events-auto absolute left-14 right-3 top-3 z-[1200] rounded-xl border border-clay/40 bg-card/95 p-3 shadow-md backdrop-blur"
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-0.5 text-clay">
          ▲
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-clay">Busy stretch ahead on your route</p>
          <p className="mt-0.5 text-sm text-ink">
            <span className="font-medium">
              {next.nearby ? `Path near ${next.street}` : next.street}
            </span>{" "}
            — {distanceAhead(next)}, about {next.eta_min} min in. Around {next.people_per_min}{" "}
            people a minute, {duration(next)}.
          </p>
          {more > 0 && (
            <p className="mt-1 text-xs text-inksoft">
              {more} more busy {more === 1 ? "stretch" : "stretches"} later on this route.
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss warning"
          className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-inksoft hover:bg-mist focus-visible:outline-2 focus-visible:outline-clay"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
