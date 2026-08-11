import { ALTERNATIVE_COLOR } from "./route-colors";

/* AC 1.2.4's smiling-face marker. The shapes live here as a plain string so
   the same face can be handed to Leaflet (which wants HTML for a divIcon) and
   rendered inside the warning banner, without the two drifting apart. */
export function smileyFace(color: string = ALTERNATIVE_COLOR): string {
  return `
    <circle cx="17" cy="17" r="14.5" fill="#ffffff" stroke="${color}" stroke-width="3"/>
    <circle cx="11.8" cy="13.6" r="1.9" fill="${color}"/>
    <circle cx="22.2" cy="13.6" r="1.9" fill="${color}"/>
    <path d="M10.5 20 Q17 25.5 23.5 20" fill="none" stroke="${color}"
          stroke-width="2.6" stroke-linecap="round"/>`;
}

export function smileyIconHtml(size = 34, label = "Calmer alternative route"): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 34 34"
               role="img" aria-label="${label}"
               style="filter:drop-shadow(0 1px 3px rgb(16 32 43 / 0.35))">
            ${smileyFace()}
          </svg>`;
}
