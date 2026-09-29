import "./_load-env";

import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Tryghed";
const KATEGORI_SLUG = "tryghed";
const NOEGLETAL_NAVN = "Anmeldte forbrydelser pr. 1.000 indbyggere";
const NOEGLETAL_BESKRIVELSE =
  "Antal anmeldte forbrydelser i alt i hele 2025 (alle fire kvartaler lagt sammen) pr. 1.000 indbyggere (Danmarks Statistik, STRAF11 og FOLK1AM). Tæller hvor forbrydelsen er begået, så fx lufthavne og bymidter trækker op. Anmeldelser uden oplyst kommune er ikke med. Færre anmeldelser giver en højere score.";

// STRAF11: anmeldte forbrydelser (overtrædelsens art i alt) pr. kvartal i 2025.
// Kvartalerne lægges sammen til et helt år.
const FORBRYDELSE_KILDE = "data/kilder/anmeldte-forbrydelser-straf11.xlsx";
const FORBRYDELSE_NAVNEKOLONNE = 1;
const AAR = "2025";
const KVARTALER = ["K1", "K2", "K3", "K4"].map((k) => `${AAR}${k}`);

// FOLK1AM: befolkningen 1. december 2024 (samme fil som Spisesteder bruger).
const BEFOLKNING_KILDE = "data/kilder/befolkning-folk1am.xlsx";
const BEFOLKNING_NAVNEKOLONNE = 2;
const BEFOLKNING_VAERDIKOLONNE = 3;

function laesArk(fil: string) {
  const arbejdsbog = XLSX.readFile(path.join(process.cwd(), fil));
  const ark = arbejdsbog.Sheets[arbejdsbog.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ark, { header: 1, raw: true }) as unknown[][];
}

/** Tal pr. område-navn. Rækker der ikke er kommuner frasorteres senere, fordi kun
 * navne fra kommuner-tabellen slås op. */
function laesTal(fil: string, navnekolonne: number, vaerdikolonne: number): Map<string, number> {
  const tal = new Map<string, number>();
  for (const linje of laesArk(fil)) {
    const navn = linje[navnekolonne];
    const vaerdi = linje[vaerdikolonne];
    if (typeof navn === "string" && typeof vaerdi === "number") {
      tal.set(navn.trim(), vaerdi);
    }
  }
  return tal;
}

/** Årets anmeldte forbrydelser pr. område-navn; kun rækker med tal for alle fire kvartaler. */
function laesForbrydelser(): Map<string, number> {
  const raa = laesArk(FORBRYDELSE_KILDE);
  const overskrift = raa.find((linje) => linje.includes(KVARTALER[0]));
  const kolonner = KVARTALER.map((k) => overskrift?.indexOf(k) ?? -1);
  if (kolonner.some((i) => i < 0)) {
    throw new Error(`${FORBRYDELSE_KILDE}: fandt ikke kolonnerne ${KVARTALER.join(", ")}.`);
  }

  const antal = new Map<string, number>();
  for (const linje of raa) {
    const navn = linje[FORBRYDELSE_NAVNEKOLONNE];
    if (typeof navn !== "string") continue;
    const tal = kolonner.map((i) => linje[i]);
    if (tal.every((t): t is number => typeof t === "number")) {
      antal.set(navn.trim(), tal.reduce((a, b) => a + b, 0));
    }
  }
  return antal;
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const forbrydelser = laesForbrydelser();
  const befolkning = laesTal(BEFOLKNING_KILDE, BEFOLKNING_NAVNEKOLONNE, BEFOLKNING_VAERDIKOLONNE);

  const manglende = alleKommuner.filter(
    (k) => !forbrydelser.has(k.navn) || !befolkning.get(k.navn),
  );
  if (manglende.length > 0) {
    throw new Error(`Mangler data for ${manglende.map((k) => k.navn).join(", ")}`);
  }

  // Ny kategori sorteres efter de eksisterende.
  const [{ maksSortering }] = await db
    .select({ maksSortering: sql<number>`coalesce(max(${kategorier.sortering}), 0)` })
    .from(kategorier);

  const [kategori] = await db
    .insert(kategorier)
    .values({
      navn: KATEGORI_NAVN,
      slug: KATEGORI_SLUG,
      ikon: "shield-check",
      standardvaegt: "1",
      sortering: Number(maksSortering) + 1,
    })
    .onConflictDoUpdate({ target: kategorier.slug, set: { navn: sql`excluded.navn` } })
    .returning();

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
        enhed: "anmeldelser",
        retning: "lavere_bedre",
        beskrivelse: NOEGLETAL_BESKRIVELSE,
      })
      .returning();
  } else {
    await db
      .update(noegletal)
      .set({ beskrivelse: NOEGLETAL_BESKRIVELSE })
      .where(eq(noegletal.id, noegletalRow.id));
  }

  for (const kommune of alleKommuner) {
    const prTusind = (forbrydelser.get(kommune.navn)! / befolkning.get(kommune.navn)!) * 1000;
    await db
      .insert(kommuneNoegletal)
      .values({
        kommuneKode: kommune.kode,
        noegletalId: noegletalRow.id,
        vaerdi: prTusind.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
        set: { vaerdi: sql`excluded.vaerdi` },
      });
  }

  console.log(
    `Oprettede kategorien "${KATEGORI_NAVN}" med nøgletallet "${NOEGLETAL_NAVN}" for ${alleKommuner.length} kommuner.`,
  );
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
