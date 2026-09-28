import "./_load-env";

import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Spisesteder";
const KATEGORI_SLUG = "spisesteder";
const NOEGLETAL_NAVN = "Spisesteder pr. 1.000 indbyggere";
const NOEGLETAL_BESKRIVELSE =
  "Antal firmaer i 2024 inden for restauration og overnatning pr. 1.000 indbyggere (Danmarks Statistik, GF12 og FOLK1AM). Omfatter restauranter, pizzeriaer, grillbarer, isbarer, caféer, værtshuse, diskoteker, event catering, anden restaurationsvirksomhed, konferencecentre, ferieboliger, campingpladser og andre overnatningsfaciliteter. Flere steder giver en højere score.";

// GF12 (Danmarks Statistik): antal firmaer pr. branche. Efter aftale summeres
// ALLE branche-kolonner i filen, uanset hvilke der er med — også overgruppen
// "56000 Restauranter", selvom den overlapper de detaljerede 56xxxx-brancher.
// Branche-kolonner genkendes på, at overskriften starter med en branchekode.
const FIRMA_KILDE = "data/kilder/spisesteder-gf12.xlsx";
const FIRMA_NAVNEKOLONNE = 1;
const BRANCHEKODE = /^\d{5,6} /;

// FOLK1AM: befolkningen 1. december 2024.
const BEFOLKNING_KILDE = "data/kilder/befolkning-folk1am.xlsx";
const BEFOLKNING_NAVNEKOLONNE = 2;
const BEFOLKNING_VAERDIKOLONNE = 3;

function laesArk(fil: string) {
  const arbejdsbog = XLSX.readFile(path.join(process.cwd(), fil));
  const ark = arbejdsbog.Sheets[arbejdsbog.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ark, { header: 1, raw: true }) as unknown[][];
}

/** Antal spisesteder pr. område-navn. Rækker der ikke er kommuner frasorteres
 * senere, fordi kun navne fra kommuner-tabellen slås op. */
function laesSpisesteder(): Map<string, number> {
  const raa = laesArk(FIRMA_KILDE);
  const overskrift = raa.find((linje) =>
    linje.some((celle) => typeof celle === "string" && BRANCHEKODE.test(celle)),
  );
  if (!overskrift) throw new Error(`${FIRMA_KILDE}: fandt ikke branche-overskrifterne.`);

  const kolonner = overskrift.flatMap((celle, i) =>
    typeof celle === "string" && BRANCHEKODE.test(celle) ? [i] : [],
  );
  console.log(`Summerer ${kolonner.length} brancher: ${kolonner.map((i) => overskrift[i]).join(", ")}`);

  const antal = new Map<string, number>();
  for (const linje of raa) {
    const navn = linje[FIRMA_NAVNEKOLONNE];
    if (typeof navn !== "string") continue;
    const tal = kolonner.map((i) => linje[i]);
    if (tal.every((t): t is number => typeof t === "number")) {
      antal.set(navn.trim(), tal.reduce((a, b) => a + b, 0));
    }
  }
  return antal;
}

function laesBefolkning(): Map<string, number> {
  const befolkning = new Map<string, number>();
  for (const linje of laesArk(BEFOLKNING_KILDE)) {
    const navn = linje[BEFOLKNING_NAVNEKOLONNE];
    const vaerdi = linje[BEFOLKNING_VAERDIKOLONNE];
    if (typeof navn === "string" && typeof vaerdi === "number") {
      befolkning.set(navn.trim(), vaerdi);
    }
  }
  return befolkning;
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const spisesteder = laesSpisesteder();
  const befolkning = laesBefolkning();

  const manglende = alleKommuner.filter(
    (k) => !spisesteder.has(k.navn) || !befolkning.get(k.navn),
  );
  if (manglende.length > 0) {
    throw new Error(`Mangler data for ${manglende.map((k) => k.navn).join(", ")}`);
  }

  const [kategori] = await db
    .insert(kategorier)
    .values({
      navn: KATEGORI_NAVN,
      slug: KATEGORI_SLUG,
      ikon: "tools-kitchen-2",
      standardvaegt: "1",
      sortering: 3,
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
        enhed: "spisesteder",
        retning: "hoejere_bedre",
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
    const prTusind = (spisesteder.get(kommune.navn)! / befolkning.get(kommune.navn)!) * 1000;
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
