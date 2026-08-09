// Sensory settings live ONLY in the user's browser (no logins, no user table).
// Sent with each API request; clearing browser data deletes the profile.
import type { Weights } from "./api";

export type SensorySettings = {
  weights: Weights;
  threshold: number;
  alertsEnabled: boolean;
};

const KEY = "sensorySettings";

export const DEFAULT_SETTINGS: SensorySettings = {
  weights: { crowd: 0.5, noise: 0.3, light: 0.2 },
  threshold: 60,
  alertsEnabled: true,
};

export function loadSettings(): SensorySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      weights: { ...DEFAULT_SETTINGS.weights, ...parsed.weights },
      threshold: parsed.threshold ?? DEFAULT_SETTINGS.threshold,
      alertsEnabled: parsed.alertsEnabled ?? DEFAULT_SETTINGS.alertsEnabled,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: SensorySettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
