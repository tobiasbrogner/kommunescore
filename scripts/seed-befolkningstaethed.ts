import "./_load-env";

import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { geometriArealKm2 } from "@/lib/kommuner/areal";
import { revaliderScores } from "./_revalider";

// Befolkningstæthed er et ekstra nøgletal i kategorien Indbyggertal (oprettet af
// seed-indbyggertal.ts). Antal indbyggere siger mest om kommunens størrelse; tætheden
// skelner byer fra store landkommuner med mange indbyggere på et stort areal.
const KATEGORI_SLUG = "indbyggertal";
const NOEGLETAL_NAVN = "Indbyggere pr. km²";
// Tætheden spænder fra ca. 15 til 12.000 pr. km², så den normaliseres logaritmisk. Den er
// et tilvalg under Prioritet på /kort og tæller ikke i standardscoren, fordi den ellers
// trækker mellemstore kommuner med store landområder (fx Vejle) ned i Indbyggertal.
const SKALA = "logaritmisk";
const STANDARD_VALGT = false;
const NOEGLETAL_BESKRIVELSE =
  "Antal indbyggere pr. km² landareal pr. 1. december 2024 (Danmarks Statistik, FOLK1AM; arealet er beregnet ud fra kommunegrænserne på kortet). Skelner byer fra store landkommuner. Flere indbyggere pr. km² giver en højere score.";

// FOLK1AM: befolkningen 1. december 2024 (samme fil som Indbyggertal bruger).
const BEFOLKNING_KILDE = "data/kilder/befolkning-folk1am.xlsx";
const BEFOLKNING_NAVNEKOLONNE = 2;
const BEFOLKNING_VAERDIKOLONNE = 3;

// Samme kommunegrænser som kortet og rapportens areal.
const KOMMUNER_GEOJSON = "public/data/kommuner.geojson";

function laesBefolkning(): Map<string, number> {
  const arbejdsbog = XLSX.readFile(path.join(process.cwd(), BEFOLKNING_KILDE));
  const ark = arbejdsbog.Sheets[arbejdsbog.SheetNames[0]];
  const raa = XLSX.utils.sheet_to_json(ark, { header: 1, raw: true }) as unknown[][];

  const befolkning = new Map<string, number>();
  for (const linje of raa) {
    const navn = linje[BEFOLKNING_NAVNEKOLONNE];
    const vaerdi = linje[BEFOLKNING_VAERDIKOLONNE];
    if (typeof navn === "string" && typeof vaerdi === "number") {
      befolkning.set(navn.trim(), vaerdi);
    }
  }
  return befolkning;
}

/** Landareal i km² pr. kommunekode; en kommune kan bestå af flere features. */
function laesArealer(): Map<string, number> {
  const geojson = JSON.parse(
    readFileSync(path.join(process.cwd(), KOMMUNER_GEOJSON), "utf8"),
  ) as GeoJSON.FeatureCollection<GeoJSON.Geometry, { kode: string }>;

  const arealer = new Map<string, number>();
  for (const feature of geojson.features) {
    const kode = feature.properties.kode;
    arealer.set(kode, (arealer.get(kode) ?? 0) + geometriArealKm2(feature.geometry));
  }
  return arealer;
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const befolkning = laesBefolkning();
  const arealer = laesArealer();

  const manglende = alleKommuner.filter((k) => !befolkning.get(k.navn) || !arealer.get(k.kode));
  if (manglende.length > 0) {
    throw new Error(`Mangler befolkning eller areal for ${manglende.map((k) => k.navn).join(", ")}`);
  }

  const [kategori] = await db.select().from(kategorier).where(eq(kategorier.slug, KATEGORI_SLUG));
  if (!kategori) {
    throw new Error(`Kategorien "${KATEGORI_SLUG}" findes ikke. Kør db:seed:indbyggertal først.`);
  }

  // Genbrug eksisterende nøgletal ved genkørsel i stedet for at oprette dubletter.
  let [noegletalRow] = await db
    .select()
    .from(noegletal)
    .where(and(eq(noegletal.kategoriId, kategori.id), eq(noegletal.navn, NOEGLETAL_NAVN)));
  if (!noegletalRow) {
    [noegletalRow] = await db
      .insert(noegletal)
      .values({
        kategoriId: kategori.id,
        navn: NOEGLETAL_NAVN,
        enhed: "indb./km²",
        retning: "hoejere_bedre",
        skala: SKALA,
        standardValgt: STANDARD_VALGT,
        beskrivelse: NOEGLETAL_BESKRIVELSE,
      })
      .returning();
  } else {
    await db
      .update(noegletal)
      .set({ beskrivelse: NOEGLETAL_BESKRIVELSE, skala: SKALA, standardValgt: STANDARD_VALGT })
      .where(eq(noegletal.id, noegletalRow.id));
  }

  for (const kommune of alleKommuner) {
    const taethed = befolkning.get(kommune.navn)! / arealer.get(kommune.kode)!;
    await db
      .insert(kommuneNoegletal)
      .values({
        kommuneKode: kommune.kode,
        noegletalId: noegletalRow.id,
        vaerdi: taethed.toFixed(1),
      })
      .onConflictDoUpdate({
        target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
        set: { vaerdi: sql`excluded.vaerdi` },
      });
  }

  console.log(
    `Tilføjede nøgletallet "${NOEGLETAL_NAVN}" til kategorien Indbyggertal for ${alleKommuner.length} kommuner.`,
  );
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
