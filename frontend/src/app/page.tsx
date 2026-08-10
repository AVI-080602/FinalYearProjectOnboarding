"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchRoutes, fetchStatus, type Route } from "@/lib/api";
import { loadSettings } from "@/lib/settings";
import { ROUTE_ORDER } from "@/lib/route-colors";
import AppHeader from "@/components/app-header";
import SearchBox, { type Place } from "@/components/search-box";
import RouteCard from "@/components/route-card";
import RouteDetail from "@/components/route-detail";
import ThresholdAlert from "@/components/threshold-alert";

const RouteMap = dynamic(() => import("@/components/route-map"), {
  ssr: false,
});

// Short horizon on purpose: the profiles are hourly, so beyond about an hour
// the forecast stops being a forecast and starts being an average.
const DEPARTURES: { label: string; value: number }[] = [
  { label: "Now", value: 0 },
  { label: "In 30 min", value: 30 },
  { label: "In 1 hour", value: 60 },
];

function PlannerContent() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [openLabel, setOpenLabel] = useState<Route["label"] | null>(null);
  const [hoverLabel, setHoverLabel] = useState<Route["label"] | null>(null);
  const [aka, setAka] = useState<Record<string, string>>({});
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [threshold, setThreshold] = useState(60);
  const [alertsOn, setAlertsOn] = useState(true);
  // US 1.2: crowds are forecast for the walk that starts at this offset
  const [departIn, setDepartIn] = useState(0);
  const [departAt, setDepartAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<string>("checking data…");
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchStatus()
      .then((s) => setDataStatus(s.data_status))
      .catch(() => setDataStatus("route service offline"));
  }, []);

  useEffect(() => {
    const toLat = searchParams.get("toLat");
    const toLng = searchParams.get("toLng");
    const toName = searchParams.get("toName");
    if (!toLat || !toLng || !toName) return;

    const lat = Number(toLat);
    const lng = Number(toLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    setDestination({
      name: toName,
      coords: [lat, lng],
    });
  }, [searchParams]);

  // AC 1.1.1: search routes between an entered start point and destination
  async function search(depIn: number = departIn) {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    setOpenLabel(null);
    setAlertDismissed(false);
    try {
      const { weights, threshold, alertsEnabled } = loadSettings();
      setThreshold(threshold);
      setAlertsOn(alertsEnabled);
      const res = await fetchRoutes(origin.coords, destination.coords, weights, threshold, depIn);
      const sorted = [...res.routes].sort(
        (a, b) => ROUTE_ORDER.indexOf(a.label) - ROUTE_ORDER.indexOf(b.label)
      );
      // identical geometry under different lambdas = one route, one card
      const unique: Route[] = [];
      const dupNotes: Record<string, string[]> = {};
      for (const r of sorted) {
        const twin = unique.find(
          (u) => u.length_m === r.length_m && u.minutes === r.minutes && u.sli === r.sli
        );
        if (twin) {
          (dupNotes[twin.label] ??= []).push(
            r.label === "Fastest" ? "also the fastest" : "also balanced"
          );
          // the folded-away twin may be the one the API recommended: the
          // recommendation belongs to the geometry, so it moves to the card
          if (r.recommended) twin.recommended = true;
        } else {
          unique.push(r);
        }
      }
      setAka(Object.fromEntries(Object.entries(dupNotes).map(([k, v]) => [k, v.join(", ")])));
      setRoutes(unique);
      setDepartAt(res.depart_at);
      setDataStatus(res.data_status);
    } catch (e) {
      setRoutes([]);
      setError(e instanceof Error ? e.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const current = routes.find((r) => r.label === openLabel) ?? null;
  const calmest = routes.find((r) => r.label === "Lowest Sensory Load") ?? null;
  const highRoutes = routes.filter((r) => r.band === "High");
  const showAlert = alertsOn && !alertDismissed && highRoutes.length > 0 && !current;
  const calmestSli = routes.find((r) => r.label === "Lowest Sensory Load")?.sli ?? 0;

  // honest, human wording: "Updated 12 min ago", never "live" next to a stale age
  const m = dataStatus.match(/live \((\d+) min old, (\d+) sensors\)/);
  const ageMin = m ? Number(m[1]) : null;
  const statusText = m
    ? `Updated ${m[1]} min ago · ${m[2]} sensors`
    : dataStatus.replace("stale snapshot (", "Data from ").replace(" old)", " ago");
  const fresh = ageMin !== null && ageMin <= 30;

  const statusChip = (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        fresh ? "border-euca/30 bg-eucasoft text-euca" : "border-line bg-mist text-inksoft"
      }`}
      title="Where the crowd data stands right now"
    >
      <span aria-hidden>{fresh ? "●" : "○"}</span>
      {statusText}
    </span>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader statusChip={statusChip} />

      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-5 py-4 lg:flex-row">
        {/* left rail */}
        <div className="flex w-full flex-col gap-3 lg:w-[430px] lg:shrink-0">
          <section
            aria-label="Plan a route"
            className="el-1 rounded-2xl border border-line bg-card p-4"
          >
            <div className="flex flex-col gap-3">
              <SearchBox label="From" value={origin} onChange={setOrigin} allowMyLocation />
              <SearchBox label="To" value={destination} onChange={setDestination} />
            </div>

            {/* US 1.2 / F4: crowds are forecast for when you actually walk,
                so the departure time is part of the question being asked */}
            <fieldset className="mt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-inksoft">
                Leaving
              </legend>
              <div className="mt-1.5 flex gap-1.5">
                {DEPARTURES.map((d) => {
                  const active = departIn === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setDepartIn(d.value);
                        if (routes.length > 0) search(d.value);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-euca ${
                        active
                          ? "border-euca bg-eucasoft text-euca"
                          : "border-line text-inksoft hover:bg-mist"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              onClick={() => search()}
              disabled={loading || !origin || !destination}
              className="el-1 mt-4 w-full rounded-xl bg-euca px-4 py-2.5 font-semibold text-card transition-all hover:brightness-110 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ink"
            >
              {loading ? "Finding calm routes…" : "Find routes"}
            </button>
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-clay/30 bg-claysoft p-4 text-sm text-clay"
            >
              {error}
            </div>
          )}

          {/* US 1.3: threshold alert with continue-without option */}
          {showAlert && (
            <ThresholdAlert
              highRoutes={highRoutes}
              threshold={threshold}
              calmest={calmest}
              onUseCalmest={() => {
                setAlertDismissed(true);
                setOpenLabel("Lowest Sensory Load");
              }}
              onDismiss={() => setAlertDismissed(true)}
            />
          )}

          {/* AC 1.1.2/1.1.3: summaries with comfort labels */}
          {routes.length > 0 && !current && (
            <div className="flex flex-col gap-3">
              {routes.map((r, i) => (
                <RouteCard
                  key={r.label}
                  route={r}
                  open={false}
                  onOpen={() => setOpenLabel(r.label)}
                  delayMs={i * 70}
                  calmestSli={calmestSli}
                  onHover={setHoverLabel}
                  akaNote={aka[r.label]}
                />
              ))}
            </div>
          )}

          {/* AC 1.1.4-1.1.7: detail panel */}
          {current && (
            <RouteDetail
              routes={routes}
              current={current}
              departAt={departAt}
              onSwitch={(l) => setOpenLabel(l)}
              onClose={() => setOpenLabel(null)}
            />
          )}

          {routes.length === 0 && !error && !loading && (
            <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-inksoft">
              <p className="font-semibold text-ink">How it works</p>
              <p className="mt-1">
                Search any two places in Melbourne CBD. You get up to three routes: the calmest, a
                balanced option, and the fastest, each scored for crowds, noise, light and
                construction.
              </p>
            </div>
          )}
        </div>

        {/* map */}
        <div className="el-1 h-[420px] min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-line lg:h-auto">
          <RouteMap
            routes={routes}
            selected={openLabel ?? hoverLabel}
            origin={routes.length && origin ? origin.coords : null}
            destination={routes.length && destination ? destination.coords : null}
          />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1500px] px-5 pb-4 text-xs text-inksoft">
        Data: City of Melbourne Open Data (CC BY 4.0) · Map: © OpenStreetMap contributors © CARTO ·
        Search: © OpenStreetMap Nominatim · No logins, no tracking: your settings stay in your
        browser.
      </footer>
    </div>
  );
}

export default function Planner() {
  return (
    <Suspense fallback={null}>
      <PlannerContent />
    </Suspense>
  );
}
