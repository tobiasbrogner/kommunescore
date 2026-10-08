// Kortets farver: paletterne, farveskalaen og farven for en score. Bruges både af kortet
// i browseren (components/danmark-kort.tsx) og af serveren, der farver forhåndsvisningen
// med standardvægtene (app/kort/forhaandsvisning.svg), så de to giver samme farver.
import type { KategoriMeta, KommuneScore } from "@/lib/scores/compute";
import { standardPrioritet } from "@/lib/scores/prioritet-link";

// Score-farveskalaer på kortet: alle har 12 trin. Standard går fra rød til grøn;
// Lilla er en sammenhængende OKLCH-rampe fra lys til mørk i sidens accent-nuance (hue 295).
// Viridis er læselig ved alle typer farveblindhed; den er vendt, så mørkere betyder højere
// score ligesom i Lilla.
export type KortPaletId = "groen-gul-orange" | "lilla" | "viridis";
export const KORT_PALETTER: Record<KortPaletId, { navn: string; farver: readonly string[] }> = {
  "groen-gul-orange": {
    navn: "Standard",
    farver: [
      "#a6011c", // 1 – laveste (rød)
      "#b5472d",
      "#c46735",
      "#d4873e",
      "#e7ab48",
      "#ffd453",
      "#fde763", // 7 – gul
      "#d7d95f",
      "#b0cc5d",
      "#86c05a",
      "#54b558",
      "#00ab57", // 12 – højeste (grøn)
    ],
  },
  viridis: {
    navn: "Viridis",
    farver: [
      "#fde725", // 1 – laveste (gul)
      "#c2df23",
      "#86d549",
      "#52c569",
      "#2ab07f",
      "#1e9b8a",
      "#25858e",
      "#2d708e",
      "#38588c",
      "#433e85",
      "#482173",
      "#440154", // 12 – højeste (mørk lilla)
    ],
  },
  lilla: {
    navn: "Lilla",
    farver: [
      "#dcd7f0", // 1 – laveste
      "#ccc3ef",
      "#bdafec",
      "#af9ce8",
      "#a188e3",
      "#9375dc",
      "#8562d3",
      "#774ec8",
      "#6a3bbb",
      "#5d28ac",
      "#4f1699",
      "#410185", // 12 – højeste
    ],
  },
};
export const KORT_PALET_STANDARD: KortPaletId = "groen-gul-orange";
// Skæringspunkter, der deler 50-100 i lige så mange lige store score-intervaller,
// som paletten har farver.
export function kortScoreTaerskler(antalFarver: number) {
  return Array.from(
    { length: antalFarver - 1 },
    (_, i) => 50 + ((i + 1) * 50) / antalFarver,
  );
}

// Den samlede score er et vægtet gennemsnit, så kommunerne ligger tæt (typisk 10-20 point).
// Farveskalaen strækkes derfor over de viste kommuners faktiske spænd i stedet for 50-100.
// Er spændet under FARVESKALA_MIN_SPAEND, udvides det om midten, så små forskelle (fx når
// filtret kun viser få kommuner) ikke ser store ud.
export const FARVESKALA_MIN_SPAEND = 10;
export type FarveSkala = { fra: number; til: number };
export function byggFarveSkala(scorer: number[]): FarveSkala {
  if (scorer.length === 0) return { fra: 50, til: 100 };
  let fra = Math.min(...scorer);
  let til = Math.max(...scorer);
  const mangler = FARVESKALA_MIN_SPAEND - (til - fra);
  if (mangler > 0) {
    fra -= mangler / 2;
    til += mangler / 2;
    // Hold skalaen inden for 50-100 ved at skubbe den ind fra kanten.
    if (fra < 50) [fra, til] = [50, til + (50 - fra)];
    if (til > 100) [fra, til] = [fra - (til - 100), 100];
  }
  return { fra, til };
}

// En scores placering (0-100 %) på farveskalaen.
export function scoreTilProcent(score: number, skala: FarveSkala) {
  return Math.min(100, Math.max(0, ((score - skala.fra) / (skala.til - skala.fra)) * 100));
}

// Farven for en farvescore (50-100), som "step"-udtrykket i byggKommuneFyldFarve vælger den.
export function kortFarve(farveScore: number, farver: readonly string[]) {
  const taerskler = kortScoreTaerskler(farver.length);
  let i = 0;
  while (i < taerskler.length && farveScore >= taerskler[i]) i++;
  return farver[i];
}


// Kommunernes farver (kode -> farve) med standardvægtene og standardpaletten, som kortet
// viser dem, før man har ændret noget: samme vægtede gennemsnit som vaegtetScore på /kort
// (en kategori uden score tæller som bunden, 50) og farveskalaen strakt over alle kommuner.
export function standardKortFarver(kategorier: KategoriMeta[], kommuner: KommuneScore[]) {
  const medVaegt = kategorier
    .map((kat) => ({ id: kat.id, vaegt: standardPrioritet(kat.standardvaegt) }))
    .filter((k) => k.vaegt > 0);
  const sumVaegt = medVaegt.reduce((sum, k) => sum + k.vaegt, 0);
  const scorer = kommuner.map((s) => ({
    kode: s.kode,
    score:
      sumVaegt > 0
        ? medVaegt.reduce((sum, k) => sum + (s.kategorier[k.id] ?? 50) * k.vaegt, 0) / sumVaegt
        : 50,
  }));
  const skala = byggFarveSkala(scorer.map((s) => s.score));
  const farver = KORT_PALETTER[KORT_PALET_STANDARD].farver;
  return Object.fromEntries(
    scorer.map((s) => [s.kode, kortFarve(50 + scoreTilProcent(s.score, skala) / 2, farver)]),
  );
}

// Kortets baggrund og streger i lyst og mørkt tema. Kommunenavnene står på de farvede
// kommuner og er derfor ens i begge temaer. Bruges af MapLibre-kortet og af
// serveren, der tegner forhåndsvisningen (app/kort/forhaandsvisning.svg) i samme farver.
export type KortTema = "lys" | "moerk";
export const KORT_TEMA_FARVER: Record<
  KortTema,
  {
    /** Havet. */
    hav: string;
    /** Nabolandene og kommuner, der er valgt fra i filtrene eller mangler data. */
    land: string;
    /** Kommuner i den grå forhåndsvisning, før de har fået farve. */
    graaKommune: string;
    /** De tynde grænser mellem kommunerne. */
    linje: string;
    /** Den valgte kommune. */
    valgt: string;
  }
> = {
  lys: {
    hav: "#90c1de",
    land: "#e8e5d9",
    graaKommune: "#dcd8c9",
    linje: "#ffffff",
    valgt: "#4b5563",
  },
  moerk: {
    hav: "#172130",
    land: "#2c2b34",
    graaKommune: "#3a3942",
    linje: "#16151b",
    valgt: "#d4d4d8",
  },
};
