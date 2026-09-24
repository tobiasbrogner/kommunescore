import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { kommuner, kategorier, noegletal, kommuneNoegletal } from "@/lib/db/schema";
import { beregnScores, type KommuneScore, type KategoriMeta } from "@/lib/scores/compute";

export const KOMMUNE_SCORES_TAG = "kommune-scores";

export type KommuneScoresPayload = {
  kategorier: KategoriMeta[];
  kommuner: KommuneScore[];
};

async function hentOgBeregn(): Promise<KommuneScoresPayload> {
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
      .from(kategorier),
    db
      .select({
        id: noegletal.id,
        kategoriId: noegletal.kategoriId,
        retning: noegletal.retning,
        navn: noegletal.navn,
        enhed: noegletal.enhed,
        beskrivelse: noegletal.beskrivelse,
      })
      .from(noegletal),
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
      .map((n) => ({ navn: n.navn, enhed: n.enhed, beskrivelse: n.beskrivelse })),
  }));

  return {
    kategorier: kategoriMeta,
    kommuner: beregnScores(alleKommuner, kategoriMeta, raaVaerdier),
  };
}

export const getCachedKommuneScores = unstable_cache(hentOgBeregn, ["kommune-scores"], {
  tags: [KOMMUNE_SCORES_TAG],
});
