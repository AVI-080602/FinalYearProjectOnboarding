"use client";

import "leaflet/dist/leaflet.css";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { QuietSpace } from "@/types/quiet-space";

type QuietSpaceMapProps = {
  spaces: QuietSpace[];
};

const melbourneCbdCenter: [number, number] = [-37.8136, 144.9631];

export default function QuietSpaceMap({ spaces }: QuietSpaceMapProps) {
  const visibleSpaces = spaces.slice(0, 300);

  return (
    <div className="h-[420px] overflow-hidden rounded-lg border border-zinc-200">
      <MapContainer
        center={melbourneCbdCenter}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {visibleSpaces.map((space) => (
          <CircleMarker
            key={space.id}
            center={[space.latitude, space.longitude]}
            radius={6}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#3b82f6",
              fillOpacity: 0.75,
              weight: 1,
            }}
          >
            <Popup>
              <strong>{space.name}</strong>
              <br />
              {space.category}
              <br />
              Wheelchair: {space.wheelchair ?? "unknown"}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
