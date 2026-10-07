// Kommunetestens data på serveren: til siden (/kommunetest) og til et delt resultats titel og
// delebillede (app/kommunetest/billede), så de giver den samme top 6 som i browseren.
import { kommunerMedBillede } from "@/lib/kommuner/billeder";
import { REGION_NAVNE } from "@/lib/kommuner/regioner";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { byggPrioritet, findMatch, svarFraParametre } from "@/lib/kommunetest";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";
import { hentGeoFakta } from "@/lib/scores/kommune-rapport";

export const KOMMUNETEST_ANTAL_RESULTATER = 6;

export async function hentKommunetestData() {
  const [{ kategorier, kommuner: scorer }, geo] = await Promise.all([
    getCachedKommuneScores(),
    hentGeoFakta(),
  ]);
  const medBillede = new Set(kommunerMedBillede());
  const kommuner = scorer.map((k) => {
    const regionskode = geo.get(k.kode)?.regionskode ?? "";
    return {
      kode: k.kode,
      navn: k.navn,
      slug: kommuneSlug(k.navn),
      regionskode,
      region: REGION_NAVNE[regionskode] ?? null,
      harBillede: medBillede.has(k.kode),
    };
  });
  return { kategorier, scorer, kommuner };
}

/** Top 6 for et delt resultat (svarene i adressen), eller null, når adressen ikke er et. */
export async function deltTop(params: URLSearchParams) {
  const { kategorier, scorer, kommuner } = await hentKommunetestData();
  const svar = svarFraParametre(params, kategorier);
  if (!svar) return null;
  const kommunePrKode = new Map(kommuner.map((k) => [k.kode, k]));
  return findMatch(byggPrioritet(svar, kategorier), kategorier, scorer, kommuner)
    .slice(0, KOMMUNETEST_ANTAL_RESULTATER)
    .flatMap((m) => {
      const k = kommunePrKode.get(m.kode);
      return k ? [{ kode: k.kode, navn: k.navn, region: k.region, score: m.score }] : [];
    });
}

/** Søgeparametrene fra Next.js (PageProps) som URLSearchParams. */
export function somSoegeparametre(soeg: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [navn, vaerdi] of Object.entries(soeg)) {
    if (typeof vaerdi === "string") params.set(navn, vaerdi);
    else if (Array.isArray(vaerdi) && vaerdi[0] !== undefined) params.set(navn, vaerdi[0]);
  }
  return params;
}
