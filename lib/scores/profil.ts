import type { KategoriMeta, KommuneScore } from "@/lib/scores/compute";

// Styrker og fokusområder for en kommune. Bruges både på /kort og på rapportsiden.
// Hver kommune sammenlignes med alle landets kommuner, kategori for kategori. Det
// virker for et vilkårligt antal kategorier, så nye kategorier kommer automatisk med.
// Teksterne er bevidst nøgterne: styrker fremhæves, og fokusområder beskrives
// sagligt i forhold til landsgennemsnittet, uden at tale kommunen ned.

export type ProfilPunkt = { kategori: KategoriMeta; tekst: string };
export type KommuneProfil = { styrker: ProfilPunkt[]; fokus: ProfilPunkt[] };

// Alle kommuners score i én kategori (højeste først) og landsgennemsnittet.
export type KategoriFordeling = { scorer: number[]; gennemsnit: number };

const PROFIL_MAKS_PUNKTER = 2;

export function byggKategoriFordelinger(kategorier: KategoriMeta[], kommuneScores: KommuneScore[]) {
  const fordelinger = new Map<number, KategoriFordeling>();
  for (const kat of kategorier) {
    const scorer = kommuneScores
      .map((s) => s.kategorier[kat.id])
      .filter((v): v is number => v != null)
      .sort((a, b) => b - a);
    if (scorer.length === 0) continue;
    const gennemsnit = scorer.reduce((sum, v) => sum + v, 0) / scorer.length;
    fordelinger.set(kat.id, { scorer, gennemsnit });
  }
  return fordelinger;
}

function styrkeTekst(rang: number, antal: number, overGennemsnit: boolean) {
  if (rang <= 5) return "Top 5 i landet";
  if (rang <= 10) return "Top 10 i landet";
  // Hårdt mellemrum, så "%" aldrig står alene på en ny linje.
  if (rang / antal <= 0.25) return "Blandt de bedste 25 %";
  if (overGennemsnit) return "Over landsgennemsnittet";
  return "Kommunens stærkeste område";
}

function fokusTekst(overGennemsnit: boolean) {
  return overGennemsnit
    ? "Over snittet, men mindre stærk end resten"
    : "Svagere end landsgennemsnittet";
}

export function byggKommuneProfil(
  kategorier: KategoriMeta[],
  fordelinger: Map<number, KategoriFordeling>,
  scorer: Record<number, number> | undefined,
): KommuneProfil {
  const maalinger = kategorier
    .flatMap((kategori) => {
      // Kategorier, der ikke tæller i standardscoren (fx Indbyggertal, som er en smagssag),
      // er hverken styrker eller fokusområder.
      if (kategori.standardvaegt <= 0) return [];
      const score = scorer?.[kategori.id];
      const fordeling = fordelinger.get(kategori.id);
      if (score == null || !fordeling) return [];
      // Placering blandt alle kommuner (1 = bedst); lige scorer deler placering.
      const rang = 1 + fordeling.scorer.filter((v) => v > score).length;
      const antal = fordeling.scorer.length;
      return [{ kategori, score, rang, antal, overGennemsnit: score >= fordeling.gennemsnit }];
    })
    // Relativt bedste kategori først.
    .sort((a, b) => a.rang / a.antal - b.rang / b.antal || b.score - a.score);

  if (maalinger.length === 0) return { styrker: [], fokus: [] };

  // Den relativt bedste kategori er altid en styrke og den svageste altid et
  // fokusområde; kategorierne imellem fordeles efter landsgennemsnittet.
  const [bedste, ...resten] = maalinger;
  const svageste = resten.pop();
  const styrker = [bedste, ...resten.filter((m) => m.overGennemsnit)];
  const fokus = [
    ...(svageste ? [svageste] : []),
    ...resten.filter((m) => !m.overGennemsnit).reverse(),
  ];
  // Med kun én kategori afgør gennemsnittet, om den er styrke eller fokusområde.
  if (!svageste && !bedste.overGennemsnit) fokus.push(styrker.shift()!);

  return {
    styrker: styrker.slice(0, PROFIL_MAKS_PUNKTER).map((m) => ({
      kategori: m.kategori,
      tekst: styrkeTekst(m.rang, m.antal, m.overGennemsnit),
    })),
    fokus: fokus.slice(0, PROFIL_MAKS_PUNKTER).map((m) => ({
      kategori: m.kategori,
      tekst: fokusTekst(m.overGennemsnit),
    })),
  };
}
