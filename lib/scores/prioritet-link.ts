// Prioritet på /kort som tekst, så den kan gemmes i browseren (localStorage) og deles i
// linket, fx /kort?vaegt=boligpriser.80_boern.0&fra=natur&tal=boligpriser.hus.
// Kategorierne nævnes ved deres slug (ikke database-id), så linket holder, selv om
// databasen bygges op igen. Kun det, der afviger fra standarden, kommer med.

export type GemtPrioritet = {
  /** slug -> vægt 0-100 */
  vaegte: Record<string, number>;
  /** Kategorier, der er slået fra. */
  fra: string[];
  /** slug -> valgte id'er fra kortets nøgletalsvalg, fx ["hus"]. */
  noegletal: Record<string, string[]>;
};

export const PRIORITET_PARAMETRE = ["vaegt", "fra", "tal"] as const;

/** Kategoriens vægt (0-100) under Prioritet fra start: standardvægten fra databasen gange
 * 50, så vægt 1 giver 50 og vægt 0 (fx Indbyggertal, som er en smagssag) giver 0. Samme
 * forhold som i den samlede score på serveren (se beregnScores). */
export function standardPrioritet(standardvaegt: number) {
  return Math.min(100, Math.max(0, Math.round(standardvaegt * 50)));
}

// "." og "_" kodes ikke i en URL, så linket forbliver til at læse. Flere valgte nøgletal i
// samme kategori skrives som flere par: tal=indbyggertal.antal_indbyggertal.taethed.
const PAR = ".";
const LISTE = "_";

export function prioritetTilParametre(p: GemtPrioritet): URLSearchParams {
  const params = new URLSearchParams();
  const vaegte = Object.entries(p.vaegte).map(([slug, v]) => `${slug}${PAR}${v}`);
  if (vaegte.length > 0) params.set("vaegt", vaegte.join(LISTE));
  if (p.fra.length > 0) params.set("fra", p.fra.join(LISTE));
  const tal = Object.entries(p.noegletal).flatMap(([slug, ider]) => ider.map((id) => `${slug}${PAR}${id}`));
  if (tal.length > 0) params.set("tal", tal.join(LISTE));
  return params;
}

/** null, når parametrene slet ikke nævner Prioritet. Ugyldige dele springes over. */
export function prioritetFraParametre(params: URLSearchParams): GemtPrioritet | null {
  if (!PRIORITET_PARAMETRE.some((navn) => params.has(navn))) return null;

  const dele = (navn: string) => (params.get(navn) ?? "").split(LISTE).filter(Boolean);
  const par = (del: string) => {
    const i = del.indexOf(PAR);
    return i > 0 ? [del.slice(0, i), del.slice(i + 1)] : null;
  };

  const vaegte: Record<string, number> = {};
  for (const del of dele("vaegt")) {
    const [slug, tekst] = par(del) ?? [];
    const v = Number(tekst);
    if (slug && Number.isInteger(v) && v >= 0 && v <= 100) vaegte[slug] = v;
  }

  const noegletal: Record<string, string[]> = {};
  for (const del of dele("tal")) {
    const [slug, id] = par(del) ?? [];
    if (slug && id) noegletal[slug] = [...(noegletal[slug] ?? []), id];
  }

  return { vaegte, fra: dele("fra"), noegletal };
}
