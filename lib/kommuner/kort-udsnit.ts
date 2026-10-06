// Danmarks udsnit på /kort. Kortet zoomer ind, så udsnittet fylder kortet med KORT_KANT
// pixels luft (MapLibres fitBounds). Forhåndsvisningen, der vises, mens kortet indlæses,
// placeres på samme måde (se scripts/byg-kortgraenser.ts), så den ikke hopper.
export const DANMARK_BOUNDS: [[number, number], [number, number]] = [
  [7.8, 54.5],
  [15.3, 57.9],
];
export const KORT_KANT = 24;

/** Længde- og breddegrad til Web Mercator (0-1 i begge retninger), som MapLibre bruger. */
export function mercator(lon: number, lat: number): [number, number] {
  const phi = (lat * Math.PI) / 180;
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2];
}
