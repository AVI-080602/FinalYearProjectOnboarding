"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { categoryOptions } from "@/lib/quiet-space-category";
import type { QuietSpace } from "@/types/quiet-space";
import AppHeader from "@/components/app-header";

const QuietSpaceMap = dynamic(() => import("@/components/quiet-space-map"), {
  ssr: false,
});

const PAGE = 50;
const MAP_CAP = 300;

export default function Page() {
  const [spaces, setSpaces] = useState<QuietSpace[]>([]);
  const [failed, setFailed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/data/quiet-spaces.json");
        if (!response.ok) throw new Error("failed");
        setSpaces((await response.json()) as QuietSpace[]);
      } catch {
        setFailed(true);
      }
    }
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of spaces) c[s.category] = (c[s.category] ?? 0) + 1;
    return c;
  }, [spaces]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spaces.filter(
      (s) =>
        (selectedCategory.length === 0 ||
          selectedCategory.includes(s.category)) &&
        (!q || s.name.toLowerCase().includes(q))
    );
  }, [spaces, selectedCategory, query]);

  const visible = filtered.slice(0, limit);

  function toggleCategory(category: string) {
    setLimit(PAGE);
    setSelectedCategory((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-5 py-4 lg:flex-row">
        {/* left rail: filters + list */}
        <div className="flex w-full flex-col gap-3 lg:w-[430px] lg:shrink-0">
          <section className="el-1 rounded-2xl border border-line bg-card p-4">
            <h1 className="font-display text-xl text-ink">Quiet spaces</h1>
            <p className="mt-0.5 text-sm text-inksoft">
              {spaces.length > 0
                ? `${spaces.length.toLocaleString()} places to pause across the CBD`
                : "Loading places…"}
            </p>

            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Search by name"
              aria-label="Search quiet spaces by name"
              className="input-calm mt-3 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm placeholder:text-inksoft/60 focus-visible:outline-2 focus-visible:outline-euca"
            />

            <div className="mt-3 flex flex-wrap gap-1.5">
              {categoryOptions
                .filter((c) => counts[c])
                .map((category) => {
                  const active = selectedCategory.includes(category);
                  return (
                    <button
                      key={category}
                      aria-pressed={active}
                      onClick={() => toggleCategory(category)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-euca ${
                        active
                          ? "bg-euca text-card"
                          : "bg-mist text-inksoft hover:bg-line"
                      }`}
                    >
                      {category.replace(
                        "Informal Outdoor Facility (Park/Garden/Reserve)",
                        "Park / Garden"
                      )}
                      <span
                        className={`ml-1.5 tabular-nums ${
                          active ? "text-card/80" : "text-inksoft/70"
                        }`}
                      >
                        {counts[category].toLocaleString()}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>

          {failed && (
            <div
              role="alert"
              className="rounded-2xl border border-clay/30 bg-claysoft p-4 text-sm text-clay"
            >
              The places list could not be loaded. Check your connection and
              refresh: we never show an empty city as if it were real.
            </div>
          )}

          {!failed && spaces.length > 0 && (
            <section className="el-1 flex min-h-0 flex-col rounded-2xl border border-line bg-card">
              <p className="border-b border-line px-4 py-2.5 text-xs text-inksoft">
                {filtered.length.toLocaleString()} match
                {filtered.length === 1 ? "" : "es"} · showing{" "}
                {Math.min(limit, filtered.length)} in the list,{" "}
                {Math.min(filtered.length, MAP_CAP)} on the map
              </p>
              <ul className="max-h-[46vh] divide-y divide-line overflow-y-auto lg:max-h-[56vh]">
                {visible.map((space) => {
                  const active = selectedId === space.id;
                  return (
                    <li key={space.id}>
                      <button
                        onClick={() => setSelectedId(space.id)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-euca ${
                          active ? "bg-eucasoft" : "hover:bg-mist"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {space.name}
                          </span>
                          <span className="block text-xs text-inksoft">
                            {space.category}
                            {space.wheelchair === "yes" &&
                              " · wheelchair accessible"}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className={`text-xs ${active ? "text-euca" : "text-inksoft/50"}`}
                        >
                          {active ? "● on map" : "view"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {filtered.length > limit && (
                <button
                  onClick={() => setLimit((l) => l + PAGE)}
                  className="border-t border-line py-2.5 text-sm font-medium text-euca hover:bg-mist focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-euca"
                >
                  Show {Math.min(PAGE, filtered.length - limit)} more
                </button>
              )}
            </section>
          )}
        </div>

        {/* map */}
        <div className="el-1 h-[420px] min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-line lg:h-auto">
          <QuietSpaceMap
            spaces={filtered.slice(0, MAP_CAP)}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1500px] px-5 pb-4 text-xs text-inksoft">
        Data: City of Melbourne Open Data (CC BY 4.0) · Map: © OpenStreetMap
        contributors © CARTO
      </footer>
    </div>
  );
}
