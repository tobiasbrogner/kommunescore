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
  noegletal: {
    id: number;
    navn: string;
    enhed: string;
    beskrivelse: string | null;
    skala: Skala;
    // Tæller med i kategoriens score; ellers et tilvalg på /kort (se lib/db/schema.ts).
    standardValgt: boolean;
  }[];
};

export type Skala = "lineaer" | "logaritmisk";

export type KommuneScore = {
  kode: string;
  navn: string;
  samlet: number;
  // kategoriId -> score 50-100: gennemsnittet af kategoriens standardvalgte nøgletal.
  kategorier: Record<number, number>;
  // noegletalId -> score 50-100, kun for nøgletal kommunen har en værdi for. Bruges,
  // når man på /kort vælger ét bestemt nøgletal i en kategori (fx kun ejerlejligheder).
  noegletal: Record<number, number>;
  // noegletalId -> rå værdi i nøgletallets enhed (fx kr./m²), til at vise selve tallene.
  vaerdier: Record<number, number>;
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

/** Skalaen for hvert nøgletal går fra denne percentil til den modsatte (5 → 5.-95.).
 * Kommuner uden for dem får bund- eller topscoren. Ellers presser få ekstreme kommuner
 * (fx boligpriserne i hovedstadsområdet) alle andre sammen i den ene ende af skalaen. */
const BESKAER_PERCENTIL = 5;

/** Værdien ved percentilen p (0-100) i en sorteret liste, med lineær interpolation. */
function percentil(sorteret: number[], p: number) {
  const pos = ((sorteret.length - 1) * p) / 100;
  const under = Math.floor(pos);
  const over = Math.ceil(pos);
  return sorteret[under] + (sorteret[over] - sorteret[under]) * (pos - under);
}

/** Normaliserer ét nøgletals værdier på tværs af alle kommuner til 50-100 mellem
 * 5. og 95. percentil (se BESKAER_PERCENTIL), og vender skalaen om når lavere værdi
 * er bedst. Med logaritmisk skala sammenlignes logaritmen af værdierne, så fx en
 * fordobling tæller lige meget i bunden og toppen; det kræver positive værdier. */
function normaliserNoegletal(
  vaerdier: { kommuneKode: string; vaerdi: number }[],
  retning: "hoejere_bedre" | "lavere_bedre",
  eksponent = 1,
  skala: Skala = "lineaer",
) {
  const logaritmisk = skala === "logaritmisk" && vaerdier.every((v) => v.vaerdi > 0);
  const omregn = (vaerdi: number) => (logaritmisk ? Math.log(vaerdi) : vaerdi);
  const sorteret = vaerdier.map((v) => omregn(v.vaerdi)).sort((a, b) => a - b);
  const min = percentil(sorteret, BESKAER_PERCENTIL);
  const maks = percentil(sorteret, 100 - BESKAER_PERCENTIL);
  const spaend = maks - min;

  const resultat = new Map<string, number>();
  for (const { kommuneKode, vaerdi } of vaerdier) {
    const beskaaret = Math.min(maks, Math.max(min, omregn(vaerdi)));
    let andel = spaend === 0 ? 1 : (beskaaret - min) / spaend;
    if (retning === "lavere_bedre") andel = 1 - andel;
    andel = Math.pow(andel, eksponent);
    resultat.set(kommuneKode, SCORE_MIN + andel * (SCORE_MAKS - SCORE_MIN));
  }
  return resultat;
}

/** Vender en nøgletal-score (50-100) fra normaliserNoegletal om, så det modsatte er bedst,
 * fx lav befolkningstæthed for Landliv og ro på /kort. Venligheden fjernes først og
 * lægges på igen bagefter, så resultatet er det samme, som hvis retningen var vendt. */
export function omvendtScore(score: number, venlighed: number) {
  const eksponent = venlighedTilEksponent(venlighed);
  const andel = Math.min(1, Math.max(0, (score - SCORE_MIN) / (SCORE_MAKS - SCORE_MIN)));
  const omvendt = Math.pow(1 - Math.pow(andel, 1 / eksponent), eksponent);
  return SCORE_MIN + omvendt * (SCORE_MAKS - SCORE_MIN);
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
  const skalaPrNoegletal = new Map(
    kategorier.flatMap((k) => k.noegletal.map((n) => [n.id, n.skala] as const)),
  );
  // Tilvalgte nøgletal, der ikke tæller i kategoriens score. Har en kategori ingen
  // standardvalgte nøgletal, tæller de alle, så kategorien ikke står uden score.
  // Nøgletal uden metadata (fx admin-panelets forhåndsvisning) tæller altid.
  const taellerIkke = new Set(
    kategorier.flatMap((k) =>
      k.noegletal.some((n) => n.standardValgt)
        ? k.noegletal.filter((n) => !n.standardValgt).map((n) => n.id)
        : [],
    ),
  );

  // kommuneKode -> kategoriId -> liste af normaliserede nøgletal-scores
  const kategoriScorerPrKommune = new Map<string, Map<number, number[]>>();
  const noegletalScorerPrKommune = new Map<string, Record<number, number>>();
  const vaerdierPrKommune = new Map<string, Record<number, number>>();

  for (const r of raaVaerdier) {
    if (!vaerdierPrKommune.has(r.kommuneKode)) vaerdierPrKommune.set(r.kommuneKode, {});
    vaerdierPrKommune.get(r.kommuneKode)![r.noegletalId] = r.vaerdi;
  }

  for (const [noegletalId, vaerdier] of perNoegletal) {
    const retning = retningPrNoegletal.get(noegletalId)!;
    const kategoriId = kategoriPrNoegletal.get(noegletalId)!;
    const venlighed = venlighedPrKategori.get(kategoriId) ?? 0;
    const normaliseret = normaliserNoegletal(
      vaerdier,
      retning,
      venlighedTilEksponent(venlighed),
      skalaPrNoegletal.get(noegletalId),
    );

    for (const [kommuneKode, score] of normaliseret) {
      if (!noegletalScorerPrKommune.has(kommuneKode)) noegletalScorerPrKommune.set(kommuneKode, {});
      noegletalScorerPrKommune.get(kommuneKode)![noegletalId] = Math.round(score * 10) / 10;
      if (taellerIkke.has(noegletalId)) continue;

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
      noegletal: noegletalScorerPrKommune.get(kommune.kode) ?? {},
      vaerdier: vaerdierPrKommune.get(kommune.kode) ?? {},
    };
  });
}
