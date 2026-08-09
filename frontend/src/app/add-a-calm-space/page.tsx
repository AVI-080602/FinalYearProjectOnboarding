"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { categoryOptions } from "@/lib/quiet-space-category";
import AppHeader from "@/components/app-header";
import SearchBox, { type Place } from "@/components/search-box";

const PickMap = dynamic(() => import("@/components/pick-map"), { ssr: false });

export default function Page() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  // the location a submission actually uses: map pin wins, then searched place
  const coords = pin ?? place?.coords ?? null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!coords) return;

    const newSuggestion = {
      id: crypto.randomUUID(),
      name,
      category,
      address: place?.name ?? "map pin",
      latitude: coords[0],
      longitude: coords[1],
      status: "pending",
      date: new Date().toISOString(),
    };

    // TODO: Replace localStorage with POST /api/suggestions so submitted
    // places leave the device and reach the team review queue.
    const existing = JSON.parse(
      localStorage.getItem("calmSpaceSuggestions") || "[]"
    );
    localStorage.setItem(
      "calmSpaceSuggestions",
      JSON.stringify([...existing, newSuggestion])
    );

    setSuccessMsg(
      "Saved for review. Nothing is published until the team approves it."
    );
    setName("");
    setCategory("");
    setPlace(null);
    setPin(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-6">
        <h1 className="font-display text-2xl text-ink">Suggest a calm place</h1>
        <p className="mt-1 text-sm text-inksoft">
          Know somewhere quiet the map is missing? Add it here. A team member
          reviews every suggestion before it appears.
        </p>

        {successMsg && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-euca/30 bg-eucasoft px-4 py-3 text-sm text-euca"
          >
            {successMsg}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="el-1 mt-4 space-y-4 rounded-2xl border border-line bg-card p-5"
        >
          <div>
            <label
              htmlFor="name"
              className="text-xs font-semibold uppercase tracking-wide text-inksoft"
            >
              Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Courtyard behind the library"
              required
              className="input-calm mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-euca"
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="text-xs font-semibold uppercase tracking-wide text-inksoft"
            >
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="select-calm mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-euca"
            >
              <option value="">Select a category</option>
              {categoryOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {/* Location: search it, use GPS, or tap the map. Never type numbers. */}
          <div>
            <SearchBox
              label="Where is it?"
              value={place}
              onChange={(p) => {
                setPlace(p);
                setPin(null);
              }}
              allowMyLocation
            />
            <p className="mt-2 text-xs text-inksoft">
              Or tap the map to drop the pin exactly where it is.
            </p>
            <div className="mt-2 h-56 overflow-hidden rounded-xl border border-line">
              <PickMap value={coords} onPick={(ll) => setPin(ll)} />
            </div>
            <p aria-live="polite" className="mt-1.5 text-xs text-inksoft">
              {coords
                ? `Location set ${pin ? "from the map pin" : `to ${place?.name}`}`
                : "No location set yet"}
            </p>
          </div>

          <button
            type="submit"
            disabled={!coords || !name || !category}
            className="el-1 w-full rounded-xl bg-euca px-4 py-2.5 font-semibold text-card transition-all hover:brightness-110 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ink"
          >
            Submit for review
          </button>
        </form>
      </main>
    </div>
  );
}
