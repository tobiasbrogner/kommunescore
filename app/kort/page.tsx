import type { Metadata } from "next";
import { DanmarkKort } from "@/components/danmark-kort";
import { kommunerMedBillede, kortbilledVersioner } from "@/lib/kommuner/billeder";
import { sammenlignKommunenavne } from "@/lib/kommuner/navn";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";
import { hentGeoFakta } from "@/lib/scores/kommune-rapport";

export const metadata: Metadata = {
  title: "Kort | Kommuna",
  description: "Udforsk Danmarks kommuner på et interaktivt kort.",
};

export default async function KortSide() {
  const [{ kategorier, kommuner: kommuneScores }, geoFakta] = await Promise.all([
    getCachedKommuneScores(),
    hentGeoFakta(),
  ]);
  // Kommunerne med region fra start, så listen ved siden af kortet kan vises med det samme
  // i stedet for at vente på kortets grænser. Sorteret som i browseren.
  const kommuner = kommuneScores
    .map((s) => ({ kode: s.kode, navn: s.navn, regionskode: geoFakta.get(s.kode)?.regionskode ?? "" }))
    .sort((a, b) => sammenlignKommunenavne(a.navn, b.navn));

  return (
    <main>
      <h1 className="sr-only">Udforsk kortet</h1>
      <DanmarkKort
        kategorier={kategorier}
        kommuneScores={kommuneScores}
        kommuner={kommuner}
        kommunerMedBillede={kommunerMedBillede()}
        kortbilledVersioner={kortbilledVersioner()}
      />
    </main>
  );
}
