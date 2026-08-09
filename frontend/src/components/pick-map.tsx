"use client";

import "leaflet/dist/leaflet.css";

import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";

const CBD: [number, number] = [-37.8136, 144.9631];

function ClickCatcher({ onPick }: { onPick: (ll: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function PickMap({
  value,
  onPick,
}: {
  value: [number, number] | null;
  onPick: (ll: [number, number]) => void;
}) {
  return (
    <MapContainer
      center={value ?? CBD}
      zoom={15}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <ClickCatcher onPick={onPick} />
      {value && (
        <CircleMarker
          center={value}
          radius={9}
          pathOptions={{
            color: "#0d8267",
            fillColor: "#0d8267",
            fillOpacity: 0.9,
            weight: 3,
          }}
        />
      )}
    </MapContainer>
  );
}
