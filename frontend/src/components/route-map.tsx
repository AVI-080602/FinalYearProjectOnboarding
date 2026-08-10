"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Route } from "@/lib/api";
import { CONGESTION_COLOR, ROUTE_COLORS, ROUTE_DASH } from "@/lib/route-colors";

const CBD: [number, number] = [-37.8136, 144.9631];

function FitToRoutes({ routes }: { routes: Route[] }) {
  const map = useMap();
  useEffect(() => {
    if (routes.length === 0) return;
    const pts = routes.flatMap((r) => r.coords);
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      { padding: [36, 36] }
    );
  }, [routes, map]);
  return null;
}

export default function RouteMap({
  routes,
  selected,
  origin,
  destination,
}: {
  routes: Route[];
  selected: Route["label"] | null;
  origin: [number, number] | null;
  destination: [number, number] | null;
}) {
  return (
    <MapContainer center={CBD} zoom={14} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <FitToRoutes routes={routes} />

      {/* AC 1.2.1 / F5: congested stretches, drawn under the route as a
          highlighter band so they read against any route colour. */}
      {routes.map((r) =>
        selected !== null && selected !== r.label
          ? null
          : r.congestion.map((c, i) => (
              <Polyline
                key={`${r.label}-congestion-${i}`}
                positions={c.coords}
                pathOptions={{
                  color: CONGESTION_COLOR,
                  weight: 17,
                  opacity: 0.3,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              >
                <Tooltip sticky>
                  Busy: {c.nearby ? `path near ${c.street}` : c.street} · ~{c.people_per_min}{" "}
                  people/min · in ~{c.eta_min} min
                </Tooltip>
              </Polyline>
            ))
      )}

      {routes.map((r) => {
        const active = selected === null || selected === r.label;
        return (
          <Polyline
            key={r.label}
            positions={r.coords}
            pathOptions={{
              color: ROUTE_COLORS[r.label],
              weight: selected === r.label ? 7 : 5,
              opacity: active ? 0.9 : 0.25,
              dashArray: ROUTE_DASH[r.label],
              lineCap: "round",
            }}
          >
            <Tooltip sticky>
              {r.label} · {r.minutes} min · load {r.sli}
            </Tooltip>
          </Polyline>
        );
      })}

      {origin && (
        <CircleMarker
          center={origin}
          radius={8}
          pathOptions={{ color: "#22332d", fillColor: "#fdfcf9", fillOpacity: 1, weight: 3 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            Start
          </Tooltip>
        </CircleMarker>
      )}
      {destination && (
        <CircleMarker
          center={destination}
          radius={8}
          pathOptions={{ color: "#257a66", fillColor: "#257a66", fillOpacity: 1, weight: 3 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            End
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
