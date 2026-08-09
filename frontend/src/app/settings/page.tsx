"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/app-header";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type SensorySettings,
} from "@/lib/settings";

const WEIGHT_ROWS: {
  key: keyof SensorySettings["weights"];
  name: string;
  desc: string;
}[] = [
  { key: "crowd", name: "Crowds", desc: "busy footpaths, packed corners" },
  { key: "noise", name: "Noise", desc: "music venues, busy bar strips" },
  { key: "light", name: "Light", desc: "bright and flashing lighting" },
];

// AC 1.3.4: guidance in plain words, tied to the value being chosen
function thresholdGuidance(t: number): string {
  if (t <= 25)
    return "Very sensitive: even lightly busy streets will be flagged High and can trigger alerts. Expect many warnings.";
  if (t <= 50)
    return "Sensitive: moderately busy areas are flagged High. A good starting point for peak-hour travel.";
  if (t <= 75)
    return "Balanced: only genuinely intense areas are flagged High. The default of 60 sits here.";
  return "Tolerant: only the most overwhelming conditions are flagged High. Alerts will be rare.";
}

export default function SettingsPage() {
  const [s, setS] = useState<SensorySettings>(DEFAULT_SETTINGS);
  const [savedMsg, setSavedMsg] = useState(false);

  // AC 1.3.1: opening the page shows the stored settings
  useEffect(() => {
    setS(loadSettings());
  }, []);

  const weightTotal =
    s.weights.crowd + s.weights.noise + s.weights.light || 1;

  function save() {
    saveSettings(s);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-6">
        <h1 className="font-display text-2xl text-ink">My sensitivities</h1>
        <p className="mt-1 text-sm text-inksoft">
          These shape every route you get. They stay in this browser only:
          no account, no cloud, delete them by clearing browser data.
        </p>

        {/* what matters most: the mixing weights */}
        <section className="el-1 mt-4 rounded-2xl border border-line bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-inksoft">
            What affects you most?
          </h2>
          <div className="mt-3 space-y-4">
            {WEIGHT_ROWS.map((row) => {
              return (
                <div key={row.key}>
                  <div className="flex items-baseline justify-between">
                    <label
                      htmlFor={`w-${row.key}`}
                      className="text-sm font-medium text-ink"
                    >
                      {row.name}
                      <span className="ml-2 text-xs font-normal text-inksoft">
                        {row.desc}
                      </span>
                    </label>
                    <output className="text-sm font-semibold tabular-nums text-euca">
                      {Math.round(s.weights[row.key] * 100)}
                      <span className="font-normal text-inksoft">/100</span>
                    </output>
                  </div>
                  <input
                    id={`w-${row.key}`}
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(s.weights[row.key] * 100)}
                    onChange={(e) =>
                      setS({
                        ...s,
                        weights: {
                          ...s.weights,
                          [row.key]: Number(e.target.value) / 100,
                        },
                      })
                    }
                    className="mt-1.5 w-full accent-euca"
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-inksoft">
              Your resulting mix
            </p>
            <div
              className="mt-2 flex h-3 overflow-hidden rounded-full"
              role="img"
              aria-label={`Mix: crowds ${Math.round((s.weights.crowd / weightTotal) * 100)}%, noise ${Math.round((s.weights.noise / weightTotal) * 100)}%, light ${Math.round((s.weights.light / weightTotal) * 100)}%`}
            >
              <div
                className="bg-euca"
                style={{ width: `${(s.weights.crowd / weightTotal) * 100}%` }}
              />
              <div
                className="bg-slate"
                style={{ width: `${(s.weights.noise / weightTotal) * 100}%` }}
              />
              <div
                className="bg-euca/40"
                style={{ width: `${(s.weights.light / weightTotal) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-inksoft">
              <span>
                <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full bg-euca" />
                Crowds {Math.round((s.weights.crowd / weightTotal) * 100)}%
              </span>
              <span>
                <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full bg-slate" />
                Noise {Math.round((s.weights.noise / weightTotal) * 100)}%
              </span>
              <span>
                <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full bg-euca/40" />
                Light {Math.round((s.weights.light / weightTotal) * 100)}%
              </span>
            </div>
            <p className="mt-2 text-xs text-inksoft">
              Each slider sets how strongly that factor matters to you. The bar
              shows the balance your routes will actually use.
            </p>
          </div>
        </section>

        {/* AC 1.3.2/1.3.3: select and adjust the threshold */}
        <section className="el-1 mt-4 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-inksoft">
              When should we warn you?
            </h2>
            <output className="font-display text-2xl text-ink">
              {s.threshold}
            </output>
          </div>
          <input
            aria-label="Sensory load threshold"
            type="range"
            min={5}
            max={95}
            step={5}
            value={s.threshold}
            onChange={(e) => setS({ ...s, threshold: Number(e.target.value) })}
            className="mt-2 w-full accent-euca"
          />
          <div className="mt-1 flex justify-between text-[11px] text-inksoft">
            <span>warn me early</span>
            <span>only when intense</span>
          </div>
          {/* AC 1.3.4: live guidance for the chosen value */}
          <p
            aria-live="polite"
            className="mt-3 rounded-xl bg-mist px-3.5 py-2.5 text-sm text-ink"
          >
            {thresholdGuidance(s.threshold)}
          </p>
        </section>

        {/* AC 1.3.5: alerts on or off */}
        <section className="el-1 mt-4 rounded-2xl border border-line bg-card p-5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-ink">
                Alert me when a route crosses my threshold
              </span>
              <span className="block text-xs text-inksoft">
                Off means routes are still scored and labelled, just never
                interrupted with a warning.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={s.alertsEnabled}
              onChange={(e) => setS({ ...s, alertsEnabled: e.target.checked })}
              className="h-6 w-6 shrink-0 accent-euca"
            />
          </label>
        </section>

        {/* AC 1.3.6: save */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={save}
            className="el-1 flex-1 rounded-xl bg-euca px-4 py-2.5 font-semibold text-card transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-ink"
          >
            Save settings
          </button>
          <button
            onClick={() => setS(DEFAULT_SETTINGS)}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-inksoft hover:bg-mist focus-visible:outline-2 focus-visible:outline-euca"
          >
            Reset
          </button>
        </div>
        {savedMsg && (
          <p
            role="status"
            className="mt-3 rounded-xl border border-euca/30 bg-eucasoft px-4 py-2.5 text-sm text-euca"
          >
            Saved. Your next route search uses these settings.
          </p>
        )}
      </main>
    </div>
  );
}
