"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { Route } from "@/lib/api";
import { ALTERNATIVE_COLOR, CONGESTION_COLOR, ROUTE_COLORS, ROUTE_DASH } from "@/lib/route-colors";
import { smileyIconHtml } from "@/lib/smiley";

const CBD: [number, number] = [-37.8136, 144.9631];

// safe at module scope: this component is only ever loaded client-side
// (next/dynamic with ssr: false), so leaflet never runs on the server
const SMILEY_ICON = L.divIcon({
  className: "", // no leaflet default box around the face
  html: smileyIconHtml(34),
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

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
  alternative,
  origin,
  destination,
}: {
  routes: Route[];
  selected: Route["label"] | null;
  alternative: Route | null;
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
        // AC 1.2.4: the calmer way out stays fully visible in light blue even
        // while another route is the one selected
        const isAlt = alternative?.label === r.label;
        const active = isAlt || selected === null || selected === r.label;
        return (
          <Polyline
            key={r.label}
            positions={r.coords}
            pathOptions={{
              color: isAlt ? ALTERNATIVE_COLOR : ROUTE_COLORS[r.label],
              weight: isAlt || selected === r.label ? 7 : 5,
              opacity: active ? 0.9 : 0.25,
              dashArray: isAlt ? undefined : ROUTE_DASH[r.label],
              lineCap: "round",
            }}
          >
            <Tooltip sticky>
              {isAlt ? "Calmer alternative — " : ""}
              {r.label} · {r.minutes} min · load {r.sli}
            </Tooltip>
          </Polyline>
        );
      })}

      {/* AC 1.2.4: smiling-face marker on the alternative, placed mid-route so
          it never collides with the Start and End markers */}
      {alternative && alternative.coords.length > 0 && (
        <Marker
          position={alternative.coords[Math.floor(alternative.coords.length / 2)]}
          icon={SMILEY_ICON}
          zIndexOffset={600}
        >
          <Tooltip direction="top" offset={[0, -18]}>
            Calmer alternative: {alternative.minutes} min · load {alternative.sli}
          </Tooltip>
        </Marker>
      )}

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
