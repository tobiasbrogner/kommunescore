import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kommuner } from "@/lib/db/schema";
import { geometriArealKm2 } from "@/lib/kommuner/areal";
import type { KategoriMeta } from "@/lib/scores/compute";
import { getCachedRapportData, type NoegletalMeta } from "@/lib/scores/get-scores";
import { byggKategoriFordelinger, byggKommuneProfil, type KommuneProfil } from "@/lib/scores/profil";
import { REGION_NAVNE } from "@/lib/kommuner/regioner";
import { kommuneSlug } from "@/lib/kommuner/slug";

// En placering blandt alle kommuner (1 = bedst) og hvordan kommunen ligger i forhold
// til landsgennemsnittet. Lige værdier deler placering.
export type Sammenligning = {
  rang: number;
  antal: number;
  gennemsnit: number;
};

export type NoegletalRapport = NoegletalMeta & Sammenligning & { vaerdi: number };

export type KategoriRapport = Sammenligning & {
  kategori: KategoriMeta;
  score: number;
  noegletal: NoegletalRapport[];
};

// Fakta til "Om [kommune]". Tekst og største by redigeres i admin-panelet; resten
// beregnes, så det altid passer med data.
export type KommuneOm = {
  stoersteBy: string | null;
  beskrivelse: string | null;
  indbyggere: number | null;
  arealKm2: number | null;
};

export type KommuneRapport = {
  kode: string;
  navn: string;
  regionNavn: string | null;
  harBillede: boolean;
  om: KommuneOm;
  samlet: Sammenligning & { score: number };
  profil: KommuneProfil;
  kategorier: KategoriRapport[];
};

function gennemsnit(tal: number[]) {
  return tal.reduce((sum, v) => sum + v, 0) / tal.length;
}

function sammenlign(vaerdi: number, alle: number[], hoejereErBedre = true): Sammenligning {
  const bedre = alle.filter((v) => (hoejereErBedre ? v > vaerdi : v < vaerdi)).length;
  return { rang: bedre + 1, antal: alle.length, gennemsnit: gennemsnit(alle) };
}

// Region og areal står kun i kortets geojson; filen læses én gang pr. serverproces.
type GeoFakta = { regionskode: string; arealKm2: number };
let geoFakta: Promise<Map<string, GeoFakta>> | null = null;
export function hentGeoFakta() {
  geoFakta ??= readFile(path.join(process.cwd(), "public/data/kommuner.geojson"), "utf8").then(
    (tekst) => {
      const data = JSON.parse(tekst) as GeoJSON.FeatureCollection;
      return new Map(
        data.features.map((f) => [
          f.properties?.kode as string,
          {
            regionskode: f.properties?.regionskode as string,
            arealKm2: geometriArealKm2(f.geometry),
          },
        ]),
      );
    },
  );
  return geoFakta;
}

// Indbyggertallet hentes fra nøgletallet "Indbyggere" i kategorien "Indbyggertal", hvis
// det findes (kategorien har også befolkningstætheden).
const INDBYGGER_KATEGORI_SLUG = "indbyggertal";
const INDBYGGER_NOEGLETAL_NAVN = "Indbyggere";

// Adressen for en kommunekode, fx "0751" → "aarhus". Bruges til at sende gamle
// adresser med kommunekode videre til den nye adresse med navn.
export async function slugForKommuneKode(kode: string): Promise<string | null> {
  const data = await getCachedRapportData();
  const kommune = data.kommuner.find((k) => k.kode === kode);
  return kommune ? kommuneSlug(kommune.navn) : null;
}

export async function hentKommuneRapport(slug: string): Promise<KommuneRapport | null> {
  const [data, geo] = await Promise.all([getCachedRapportData(), hentGeoFakta()]);
  const kommune = data.kommuner.find((k) => kommuneSlug(k.navn) === slug);
  if (!kommune) return null;
  const kode = kommune.kode;

  // Hentes uden cache, så rettelser i admin-panelet vises med det samme.
  const [tekster] = await db
    .select({ stoersteBy: kommuner.stoersteBy, beskrivelse: kommuner.beskrivelse })
    .from(kommuner)
    .where(eq(kommuner.kode, kode));

  const indbyggerKategori = data.kategorier.find((k) => k.slug === INDBYGGER_KATEGORI_SLUG);
  const indbyggerNoegletal = data.noegletal.find(
    (n) => n.kategoriId === indbyggerKategori?.id && n.navn === INDBYGGER_NOEGLETAL_NAVN,
  );
  const indbyggere =
    data.vaerdier.find((v) => v.noegletalId === indbyggerNoegletal?.id && v.kommuneKode === kode)
      ?.vaerdi ?? null;

  const fordelinger = byggKategoriFordelinger(data.kategorier, data.kommuner);

  const kategorier = data.kategorier.map((kategori) => {
    const alleScorer = data.kommuner.map((k) => k.kategorier[kategori.id]);
    const score = kommune.kategorier[kategori.id];

    const noegletal = data.noegletal
      .filter((n) => n.kategoriId === kategori.id)
      .flatMap((n) => {
        const vaerdier = data.vaerdier.filter((v) => v.noegletalId === n.id);
        const egen = vaerdier.find((v) => v.kommuneKode === kode);
        if (!egen) return [];
        const alle = vaerdier.map((v) => v.vaerdi);
        return [{ ...n, vaerdi: egen.vaerdi, ...sammenlign(egen.vaerdi, alle, n.retning === "hoejere_bedre") }];
      });

    return { kategori, score, noegletal, ...sammenlign(score, alleScorer) };
  });

  const fakta = geo.get(kode);

  return {
    kode,
    navn: kommune.navn,
    regionNavn: fakta ? (REGION_NAVNE[fakta.regionskode] ?? null) : null,
    harBillede: existsSync(path.join(process.cwd(), "public/kommuner", `${kode}.jpg`)),
    om: {
      stoersteBy: tekster?.stoersteBy?.trim() || null,
      beskrivelse: tekster?.beskrivelse?.trim() || null,
      indbyggere,
      arealKm2: fakta?.arealKm2 ?? null,
    },
    samlet: {
      score: kommune.samlet,
      ...sammenlign(
        kommune.samlet,
        data.kommuner.map((k) => k.samlet),
      ),
    },
    profil: byggKommuneProfil(data.kategorier, fordelinger, kommune.kategorier),
    kategorier,
  };
}
