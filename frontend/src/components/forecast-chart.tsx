"use client";

import type { RouteForecastSlot } from "@/lib/api";

function barClass(score: number, threshold: number) {
  if (score >= threshold) {
    return "bg-clay";
  }

  if (score >= threshold * 0.8) {
    return "bg-amber-500";
  }

  return "bg-euca";
}

function hourLabel(time: string) {
  return new Date(time).toLocaleTimeString([], {
    hour: "numeric",
  });
}

export default function ForecastChart({
  slots,
  threshold,
}: {
  slots: RouteForecastSlot[];
  threshold: number;
}) {
  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-inksoft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-euca" />
          Comfortable
        </span>

        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Approaching threshold
        </span>

        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-clay" />
          At or above threshold
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="relative flex min-w-[1100px] items-end gap-2 border-b border-line px-2 pt-4">
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-inksoft/50"
            style={{
              bottom: `${Math.min(100, threshold)}%`,
            }}
          >
            <span className="absolute right-0 -top-5 rounded bg-card px-1 text-[10px] text-inksoft">
              Your threshold {threshold}
            </span>
          </div>

          {slots.map((slot) => {
            return (
              <div key={slot.time} className="flex min-w-[42px] flex-1 flex-col items-center">
                <div className="flex h-40 w-full flex-col items-center justify-end">
                  <span className="mb-1 text-[10px] font-semibold tabular-nums text-ink">
                    {Math.round(slot.sli)}
                  </span>

                  <div
                    className={`w-7 rounded-t-md ${barClass(slot.sli, threshold)}`}
                    style={{
                      height: `${Math.max(6, Math.min(100, slot.sli))}%`,
                    }}
                    title={`${hourLabel(slot.time)} · sensory load ${slot.sli}/100`}
                  />
                </div>

                <span className="mt-2 text-[10px] text-inksoft">{hourLabel(slot.time)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
