import type { Route } from "./api";

// Shared by cards, detail and map. Lives here (not in the map component) so
// server-rendered components never import leaflet.
export const ROUTE_COLORS: Record<Route["label"], string> = {
  "Lowest Sensory Load": "#257a66",
  Balanced: "#4a6b7c",
  Fastest: "#b25f2f",
};

// Calm-first everywhere: the order is the product's opinion.
export const ROUTE_ORDER: Route["label"][] = ["Lowest Sensory Load", "Balanced", "Fastest"];

// US 1.2: congested stretches are marked in clay, the system's warm alert
// colour. Never red, and never colour alone: the map pairs it with a tooltip
// and the panel lists every stretch in words.
export const CONGESTION_COLOR = "#c05621";

// AC 1.2.4: while a warning is up, the calmer alternative is drawn in light
// blue and marked with a smiling face. Deliberately outside the three fixed
// route colours: this is a temporary "here is your way out", not a fourth
// route identity, and it reverts the moment the warning is dismissed.
export const ALTERNATIVE_COLOR = "#3fa9dd";

// Redundant encoding: every route differs by dash pattern, not colour alone.
export const ROUTE_DASH: Record<Route["label"], string | undefined> = {
  "Lowest Sensory Load": undefined, // solid
  Balanced: "1 9", // dotted
  Fastest: "10 8", // dashed
};
