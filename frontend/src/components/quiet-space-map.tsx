"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { QuietSpace } from "@/types/quiet-space";

type QuietSpaceMapProps = {
  spaces: QuietSpace[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

const melbourneCbdCenter: [number, number] = [-37.8136, 144.9631];

function FlyToSelected({
  space,
}: {
  space: QuietSpace | undefined;
}) {
  const map = useMap();
  useEffect(() => {
    if (space) {
      map.flyTo([space.latitude, space.longitude], Math.max(map.getZoom(), 16), {
        duration: 0.6,
      });
    }
  }, [space, map]);
  return null;
}

export default function QuietSpaceMap({
  spaces,
  selectedId,
  onSelect,
}: QuietSpaceMapProps) {
  const selected = spaces.find((s) => s.id === selectedId);

  return (
    <MapContainer
      center={melbourneCbdCenter}
      zoom={14}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <FlyToSelected space={selected} />

      {spaces.map((space) => {
        const active = space.id === selectedId;
        return (
          <CircleMarker
            key={space.id}
            center={[space.latitude, space.longitude]}
            radius={active ? 10 : 5}
            eventHandlers={{ click: () => onSelect(space.id) }}
            pathOptions={{
              color: active ? "#c05621" : "#0d8267",
              fillColor: active ? "#c05621" : "#0d8267",
              fillOpacity: active ? 0.95 : 0.6,
              weight: active ? 3 : 1,
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
        );
      })}
    </MapContainer>
  );
}
