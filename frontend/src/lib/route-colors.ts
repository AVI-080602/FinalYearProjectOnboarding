import type { Route } from "./api";

// Shared by cards, detail and map. Lives here (not in the map component) so
// server-rendered components never import leaflet.
export const ROUTE_COLORS: Record<Route["label"], string> = {
  "Lowest Sensory Load": "#257a66",
  Balanced: "#4a6b7c",
  Fastest: "#b25f2f",
};

// Calm-first everywhere: the order is the product's opinion.
export const ROUTE_ORDER: Route["label"][] = [
  "Lowest Sensory Load",
  "Balanced",
  "Fastest",
];

// Redundant encoding: every route differs by dash pattern, not colour alone.
export const ROUTE_DASH: Record<Route["label"], string | undefined> = {
  "Lowest Sensory Load": undefined, // solid
  Balanced: "1 9", // dotted
  Fastest: "10 8", // dashed
};
