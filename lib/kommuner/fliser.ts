import "server-only";

import type { KommuneFliseData } from "@/components/kommune-flise";
import { kommunerMedBillede } from "@/lib/kommuner/billeder";
import { REGION_NAVNE } from "@/lib/kommuner/regioner";
import { kommuneSlug } from "@/lib/kommuner/slug";
import type { KommuneScore } from "@/lib/scores/compute";
import { hentGeoFakta } from "@/lib/scores/kommune-rapport";

// Data til kommunekortene (forsiden og /kommuner): region, foto og placering med
// standardvægte, som i rapporterne (lige scorer deler placering).
export async function byggKommuneFliser(kommuner: KommuneScore[]): Promise<KommuneFliseData[]> {
  const geo = await hentGeoFakta();
  const medBillede = new Set(kommunerMedBillede());

  return kommuner.map((k) => {
    const regionskode = geo.get(k.kode)?.regionskode;
    return {
      kode: k.kode,
      navn: k.navn,
      slug: kommuneSlug(k.navn),
      region: regionskode ? (REGION_NAVNE[regionskode] ?? null) : null,
      harBillede: medBillede.has(k.kode),
      score: Math.round(k.samlet),
      rang: 1 + kommuner.filter((a) => a.samlet > k.samlet).length,
      antal: kommuner.length,
    };
  });
}
