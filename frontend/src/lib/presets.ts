// Well-known CBD places for quick origin/destination selection (AC 1.1.1).
export type Preset = { name: string; coords: [number, number] };

export const PRESETS: Preset[] = [
  { name: "Southern Cross Station", coords: [-37.8183, 144.9526] },
  { name: "Flinders Street Station", coords: [-37.8183, 144.9671] },
  { name: "Melbourne Central", coords: [-37.81, 144.9629] },
  { name: "Parliament Station", coords: [-37.811, 144.973] },
  { name: "Flagstaff Gardens", coords: [-37.8106, 144.9542] },
  { name: "State Library Victoria", coords: [-37.8098, 144.9652] },
  { name: "Federation Square", coords: [-37.8179, 144.9691] },
  { name: "Queen Victoria Market", coords: [-37.8076, 144.9568] },
  { name: "Carlton Gardens", coords: [-37.8047, 144.9717] },
  { name: "Southbank Promenade", coords: [-37.8206, 144.9628] },
];
