"use client";

import { useEffect, useRef, useState } from "react";
import { PRESETS } from "@/lib/presets";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Place = { name: string; coords: [number, number] };

type Suggestion = Place & { detail?: string };

export default function SearchBox({
  label,
  value,
  onChange,
  allowMyLocation,
}: {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  allowMyLocation?: boolean;
}) {
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(value?.name ?? "");
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function queryChanged(q: string) {
    setText(q);
    onChange(null);
    if (timer.current) clearTimeout(timer.current);
    const presetHits = PRESETS.filter((p) =>
      p.name.toLowerCase().includes(q.toLowerCase())
    ).map((p) => ({ ...p, detail: "popular place" }));
    setSuggestions(presetHits);
    setOpen(true);
    if (q.trim().length < 3) return;
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(
          `${BASE}/api/geocode?q=${encodeURIComponent(q)}`
        );
        if (res.ok) {
          const data = await res.json();
          const geo: Suggestion[] = data.results.map(
            (r: { name: string; detail: string; lat: number; lon: number }) => ({
              name: r.name,
              detail: r.detail,
              coords: [r.lat, r.lon] as [number, number],
            })
          );
          setSuggestions((prev) => {
            const names = new Set(prev.map((p) => p.name));
            return [...prev, ...geo.filter((g) => !names.has(g.name))].slice(0, 7);
          });
        }
      } finally {
        setBusy(false);
      }
    }, 350);
  }

  function pick(s: Suggestion) {
    onChange({ name: s.name, coords: s.coords });
    setText(s.name);
    setOpen(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        pick({
          name: "My location",
          coords: [pos.coords.latitude, pos.coords.longitude],
        });
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="text-xs font-semibold uppercase tracking-wide text-inksoft">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          value={text}
          onChange={(e) => queryChanged(e.target.value)}
          onFocus={() => text && setOpen(true)}
          placeholder="Search any place or address"
          className="input-calm w-full rounded-xl border border-line px-3.5 py-2.5 text-sm placeholder:text-inksoft/60 focus-visible:outline-2 focus-visible:outline-euca"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
        />
        {busy && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-inksoft">
            …
          </span>
        )}
      </div>

      {open && (suggestions.length > 0 || allowMyLocation) && (
        <ul className="el-2 absolute z-[1100] mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-card py-1">
          {allowMyLocation && (
            <li>
              <button
                onClick={useMyLocation}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-medium text-euca hover:bg-mist"
              >
                <span aria-hidden>◎</span> Use my current location
              </button>
            </li>
          )}
          {suggestions.map((s) => (
            <li key={`${s.name}-${s.coords[0]}`}>
              <button
                onClick={() => pick(s)}
                className="w-full px-3.5 py-2 text-left text-sm hover:bg-mist"
              >
                <span className="font-medium">{s.name}</span>
                {s.detail && (
                  <span className="ml-2 text-xs text-inksoft">{s.detail}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
