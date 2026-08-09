"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

const CBD: [number, number] = [-37.8136, 144.9631];

export default function PickMap({
  value,
  onPick,
}: {
  value: [number, number] | null;
  onPick: (ll: [number, number]) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: CBD,
      zoom: 15,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    map.on("click", (event) => {
      onPickRef.current([event.latlng.lat, event.latlng.lng]);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(value, {
        radius: 9,
        color: "#0d8267",
        fillColor: "#0d8267",
        fillOpacity: 0.9,
        weight: 3,
      }).addTo(mapRef.current);
    } else {
      markerRef.current.setLatLng(value);
    }

    mapRef.current.flyTo(value, Math.max(mapRef.current.getZoom(), 15), {
      duration: 0.4,
    });
  }, [value]);

  return <div ref={containerRef} className="h-full w-full" />;
}
