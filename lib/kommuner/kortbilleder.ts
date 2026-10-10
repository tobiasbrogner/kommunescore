// De færdige små fotos til kortene på /kort (se scripts/byg-kortbilleder.ts). Bruges både af
// scriptet og af kortene, så de er enige om bredder og filnavne.

// 400 til smalle kort, 700 til de fleste skærme, 1000 til mobiler med skarp skærm, hvor
// kortet fylder hele bredden.
export const KORTBILLEDE_BREDDER = [400, 700, 1000] as const;

// Bredde/højde. Kortene er mellem ca. 2,6:1 (fire kolonner) og 4,5:1 (boksen på kortet);
// object-cover skærer resten væk fra midten, ligesom med det fulde foto.
export const KORTBILLEDE_FORHOLD = 3;

export function kortbilledeSrcSet(kode: string, version: string, format: "avif" | "webp"): string {
  return KORTBILLEDE_BREDDER.map((b) => `/kommuner/kort/${kode}.${version}.${b}.${format} ${b}w`).join(", ");
}
