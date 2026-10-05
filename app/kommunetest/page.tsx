import type { Metadata } from "next";
import { Kommunetest } from "@/components/kommunetest";
import { kommunerMedBillede } from "@/lib/kommuner/billeder";
import { REGION_NAVNE } from "@/lib/kommuner/regioner";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";
import { hentGeoFakta } from "@/lib/scores/kommune-rapport";

export const metadata: Metadata = {
  title: "Kommunetesten | Kommuna",
  description:
    "Svar på 20 korte spørgsmål om, hvor og hvordan du vil bo, og find de seks kommuner, der passer bedst til dig.",
};

export default async function KommunetestSide() {
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

  return <Kommunetest kategorier={kategorier} scorer={scorer} kommuner={kommuner} />;
}
