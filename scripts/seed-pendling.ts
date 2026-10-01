import "./_load-env";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Pendling";
const KATEGORI_SLUG = "pendling";
const NOEGLETAL_NAVN = "Pendlingsafstand";

// AFSTB4 hentes direkte fra Statistikbankens API i stedet for en downloadet fil.
const DST_API = "https://api.statbank.dk/v1/data";
const TABEL = "AFSTB4";
const AAR = "2024";
const BESKAEFTIGEDE_I_ALT = "02";
const KOEN_I_ALT = "TOT";

const NOEGLETAL_BESKRIVELSE = `Gennemsnitlig afstand i km mellem bopæl og arbejdssted for beskæftigede, der bor i kommunen, ultimo november ${AAR} (Danmarks Statistik, ${TABEL}). Viser, hvor tæt der er til job fra kommunen; på øer som Læsø og Bornholm er afstanden kort, fordi de fleste arbejder lokalt. En kortere afstand giver en højere score.`;

/** Pendlingsafstand i km pr. DST-kommunekode uden foranstillede nuller (fx "101"). */
async function hentPendlingsafstand(): Promise<Map<string, number>> {
  const svar = await fetch(DST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: TABEL,
      format: "CSV",
      lang: "da",
      valuePresentation: "Code",
      variables: [
        { code: "BOPOMR", values: ["*"] },
        { code: "SOCIO", values: [BESKAEFTIGEDE_I_ALT] },
        { code: "KØN", values: [KOEN_I_ALT] },
        { code: "Tid", values: [AAR] },
      ],
    }),
  });
  if (!svar.ok) throw new Error(`${TABEL}: HTTP ${svar.status} ${await svar.text()}`);

  const afstande = new Map<string, number>();
  // Første linje er overskriften: BOPOMR;SOCIO;KØN;TID;INDHOLD (decimalkomma).
  for (const linje of (await svar.text()).trim().split("\n").slice(1)) {
    const [omraade, , , , indhold] = linje.trim().split(";");
    const tal = Number(indhold?.replace(",", "."));
    if (Number.isFinite(tal)) afstande.set(omraade, tal);
  }
  if (afstande.size === 0) throw new Error(`${TABEL}: svaret indeholdt ingen tal.`);
  return afstande;
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const afstande = await hentPendlingsafstand();
  const afstand = (kode: string) => afstande.get(String(Number(kode)));

  const manglende = alleKommuner.filter((k) => afstand(k.kode) === undefined);
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
      ikon: "car",
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
        enhed: "km",
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
    await db
      .insert(kommuneNoegletal)
      .values({
        kommuneKode: kommune.kode,
        noegletalId: noegletalRow.id,
        vaerdi: afstand(kommune.kode)!.toFixed(2),
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
