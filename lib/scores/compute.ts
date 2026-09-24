export type RaaVaerdi = {
  kommuneKode: string;
  noegletalId: number;
  kategoriId: number;
  retning: "hoejere_bedre" | "lavere_bedre";
  vaerdi: number;
};

export type KategoriMeta = {
  id: number;
  navn: string;
  slug: string;
  standardvaegt: number;
  venlighed: number;
  ikon: string | null;
  noegletal: { navn: string; enhed: string; beskrivelse: string | null }[];
};

export type KommuneScore = {
  kode: string;
  navn: string;
  samlet: number;
  kategorier: Record<number, number>; // kategoriId -> score 50-100
};

const SCORE_MIN = 50;
const SCORE_MAKS = 100;

/** Kategoriens venlighed (0-100) som eksponent på den normaliserede andel:
 * 0 → 1 (lineær), 50 → 0,5 (kvadratrod), 100 → 0,25. En eksponent under 1
 * løfter lave og mellemste værdier, mens bund (50), top (100) og rækkefølgen
 * er uændret. Det hjælper kategorier hvor få ekstreme kommuner ellers
 * presser alle andre ned mod bunden. */
export function venlighedTilEksponent(venlighed: number) {
  return Math.pow(2, -Math.min(100, Math.max(0, venlighed)) / 50);
}

/** Min-max-normaliserer ét nøgletals værdier på tværs af alle kommuner til 50-100,
 * og vender skalaen om når lavere værdi er bedst. */
function normaliserNoegletal(
  vaerdier: { kommuneKode: string; vaerdi: number }[],
  retning: "hoejere_bedre" | "lavere_bedre",
  eksponent = 1,
) {
  const tal = vaerdier.map((v) => v.vaerdi);
  const min = Math.min(...tal);
  const maks = Math.max(...tal);
  const spaend = maks - min;

  const resultat = new Map<string, number>();
  for (const { kommuneKode, vaerdi } of vaerdier) {
    let andel = spaend === 0 ? 1 : (vaerdi - min) / spaend;
    if (retning === "lavere_bedre") andel = 1 - andel;
    andel = Math.pow(andel, eksponent);
    resultat.set(kommuneKode, SCORE_MIN + andel * (SCORE_MAKS - SCORE_MIN));
  }
  return resultat;
}

export function beregnScores(
  kommuner: { kode: string; navn: string }[],
  kategorier: KategoriMeta[],
  raaVaerdier: RaaVaerdi[],
): KommuneScore[] {
  // Gruppér rå værdier pr. nøgletal og normalisér hvert nøgletal for sig.
  const perNoegletal = new Map<number, { kommuneKode: string; vaerdi: number }[]>();
  const retningPrNoegletal = new Map<number, "hoejere_bedre" | "lavere_bedre">();
  const kategoriPrNoegletal = new Map<number, number>();

  for (const r of raaVaerdier) {
    if (!perNoegletal.has(r.noegletalId)) perNoegletal.set(r.noegletalId, []);
    perNoegletal.get(r.noegletalId)!.push({ kommuneKode: r.kommuneKode, vaerdi: r.vaerdi });
    retningPrNoegletal.set(r.noegletalId, r.retning);
    kategoriPrNoegletal.set(r.noegletalId, r.kategoriId);
  }

  const venlighedPrKategori = new Map(kategorier.map((k) => [k.id, k.venlighed]));

  // kommuneKode -> kategoriId -> liste af normaliserede nøgletal-scores
  const kategoriScorerPrKommune = new Map<string, Map<number, number[]>>();

  for (const [noegletalId, vaerdier] of perNoegletal) {
    const retning = retningPrNoegletal.get(noegletalId)!;
    const kategoriId = kategoriPrNoegletal.get(noegletalId)!;
    const venlighed = venlighedPrKategori.get(kategoriId) ?? 0;
    const normaliseret = normaliserNoegletal(vaerdier, retning, venlighedTilEksponent(venlighed));

    for (const [kommuneKode, score] of normaliseret) {
      if (!kategoriScorerPrKommune.has(kommuneKode)) {
        kategoriScorerPrKommune.set(kommuneKode, new Map());
      }
      const kategoriMap = kategoriScorerPrKommune.get(kommuneKode)!;
      if (!kategoriMap.has(kategoriId)) kategoriMap.set(kategoriId, []);
      kategoriMap.get(kategoriId)!.push(score);
    }
  }

  const samletVaegt = kategorier.reduce((sum, k) => sum + k.standardvaegt, 0) || 1;

  return kommuner.map((kommune) => {
    const kategoriMap = kategoriScorerPrKommune.get(kommune.kode) ?? new Map();
    const kategoriScores: Record<number, number> = {};
    let samletSum = 0;

    for (const kategori of kategorier) {
      const scores = kategoriMap.get(kategori.id);
      const kategoriScore = scores && scores.length > 0
        ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        : SCORE_MIN;
      kategoriScores[kategori.id] = Math.round(kategoriScore * 10) / 10;
      samletSum += kategoriScore * kategori.standardvaegt;
    }

    return {
      kode: kommune.kode,
      navn: kommune.navn,
      samlet: Math.round((samletSum / samletVaegt) * 10) / 10,
      kategorier: kategoriScores,
    };
  });
}
