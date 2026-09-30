import { unstable_cache } from "next/cache";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { kommuner, kategorier, noegletal, kommuneNoegletal } from "@/lib/db/schema";
import {
  beregnScores,
  type KommuneScore,
  type KategoriMeta,
  type RaaVaerdi,
} from "@/lib/scores/compute";

export const KOMMUNE_SCORES_TAG = "kommune-scores";

export type KommuneScoresPayload = {
  kategorier: KategoriMeta[];
  kommuner: KommuneScore[];
};

export type NoegletalMeta = {
  id: number;
  kategoriId: number;
  navn: string;
  enhed: string;
  retning: "hoejere_bedre" | "lavere_bedre";
  beskrivelse: string | null;
};

// Rapportsiden har også brug for de rå nøgletal (fx antal indbyggere), ikke kun scorerne.
export type RapportPayload = KommuneScoresPayload & {
  noegletal: NoegletalMeta[];
  vaerdier: RaaVaerdi[];
};

async function hentOgBeregnAlt(): Promise<RapportPayload> {
  const [alleKommuner, alleKategorier, alleNoegletal, alleVaerdier] = await Promise.all([
    db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner),
    db
      .select({
        id: kategorier.id,
        navn: kategorier.navn,
        slug: kategorier.slug,
        standardvaegt: kategorier.standardvaegt,
        venlighed: kategorier.venlighed,
        ikon: kategorier.ikon,
      })
      .from(kategorier)
      // Samme rækkefølge som i admin-panelet; uden den afhænger rækkefølgen af,
      // hvornår en kategori sidst blev gemt.
      .orderBy(asc(kategorier.sortering), asc(kategorier.id)),
    db
      .select({
        id: noegletal.id,
        kategoriId: noegletal.kategoriId,
        retning: noegletal.retning,
        skala: noegletal.skala,
        standardValgt: noegletal.standardValgt,
        navn: noegletal.navn,
        enhed: noegletal.enhed,
        beskrivelse: noegletal.beskrivelse,
      })
      .from(noegletal)
      .orderBy(asc(noegletal.id)),
    db
      .select({
        kommuneKode: kommuneNoegletal.kommuneKode,
        noegletalId: kommuneNoegletal.noegletalId,
        vaerdi: kommuneNoegletal.vaerdi,
      })
      .from(kommuneNoegletal),
  ]);

  const noegletalPrId = new Map(alleNoegletal.map((n) => [n.id, n]));

  const raaVaerdier = alleVaerdier.flatMap((v) => {
    const meta = noegletalPrId.get(v.noegletalId);
    if (!meta) return [];
    return [
      {
        kommuneKode: v.kommuneKode,
        noegletalId: v.noegletalId,
        kategoriId: meta.kategoriId,
        retning: meta.retning,
        vaerdi: Number(v.vaerdi),
      },
    ];
  });

  const kategoriMeta: KategoriMeta[] = alleKategorier.map((k) => ({
    id: k.id,
    navn: k.navn,
    slug: k.slug,
    standardvaegt: Number(k.standardvaegt),
    venlighed: k.venlighed,
    ikon: k.ikon,
    noegletal: alleNoegletal
      .filter((n) => n.kategoriId === k.id)
      .map((n) => ({
        id: n.id,
        navn: n.navn,
        enhed: n.enhed,
        beskrivelse: n.beskrivelse,
        skala: n.skala,
        standardValgt: n.standardValgt,
      })),
  }));

  return {
    kategorier: kategoriMeta,
    kommuner: beregnScores(alleKommuner, kategoriMeta, raaVaerdier),
    noegletal: alleNoegletal,
    vaerdier: raaVaerdier,
  };
}

async function hentOgBeregn(): Promise<KommuneScoresPayload> {
  const { kategorier, kommuner } = await hentOgBeregnAlt();
  return { kategorier, kommuner };
}

// Nøglerne bumpes, når payloadens form eller beregningen ændres, så en gammel cache ikke
// genbruges.
export const getCachedKommuneScores = unstable_cache(hentOgBeregn, ["kommune-scores-v5"], {
  tags: [KOMMUNE_SCORES_TAG],
});

export const getCachedRapportData = unstable_cache(hentOgBeregnAlt, ["kommune-rapport-data-v5"], {
  tags: [KOMMUNE_SCORES_TAG],
});
