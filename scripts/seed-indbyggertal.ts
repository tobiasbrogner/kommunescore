import "./_load-env";

import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Indbyggertal";
const KATEGORI_SLUG = "indbyggertal";
const NOEGLETAL_NAVN = "Indbyggere";
const NOEGLETAL_BESKRIVELSE =
  "Antal indbyggere i kommunen pr. 1. december 2024 (Danmarks Statistik, FOLK1AM). Flere indbyggere giver en højere score.";

// Befolkningstal er meget skævt fordelt (København har ~40 gange så mange indbyggere
// som medianen), så en lineær skala ville presse næsten alle kommuner ned mod 50.
// Venlighed 50 løfter de mellemstore kommuner; kan justeres i admin-panelet.
const VENLIGHED = 50;

// FOLK1AM: befolkningen 1. december 2024 (samme fil som Spisesteder bruger).
const BEFOLKNING_KILDE = "data/kilder/befolkning-folk1am.xlsx";
const BEFOLKNING_NAVNEKOLONNE = 2;
const BEFOLKNING_VAERDIKOLONNE = 3;

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

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const befolkning = laesBefolkning();

  const manglende = alleKommuner.filter((k) => !befolkning.get(k.navn));
  if (manglende.length > 0) {
    throw new Error(`Mangler befolkningstal for ${manglende.map((k) => k.navn).join(", ")}`);
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
      ikon: "users",
      standardvaegt: "1",
      sortering: Number(maksSortering) + 1,
      venlighed: VENLIGHED,
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
        enhed: "indbyggere",
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
    await db
      .insert(kommuneNoegletal)
      .values({
        kommuneKode: kommune.kode,
        noegletalId: noegletalRow.id,
        vaerdi: String(befolkning.get(kommune.navn)!),
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
