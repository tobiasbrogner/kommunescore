import "./_load-env";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Sundhed";
const KATEGORI_SLUG = "sundhed";

// Tabellerne hentes direkte fra Statistikbankens API i stedet for downloadede filer.
const DST_API = "https://api.statbank.dk/v1/data";

// Nøgletallenes navne må ikke indeholde "gennemsnit": så vises de som kategoriens
// samlede gennemsnit i infoboksen på /kort (se erGennemsnit i components/danmark-kort.tsx).
type Kilde = {
  navn: string;
  enhed: string;
  retning: "hoejere_bedre" | "lavere_bedre";
  beskrivelse: string;
  tabel: string;
  // Variablerne til API'et; områdevariablen hentes for alle områder ("*").
  omraadeVariabel: string;
  variabler: Record<string, string>;
  // Kommuner uden tal (fx små øer, hvor DST ikke offentliggør) springes over i kategorien.
  maaMangle: boolean;
};

const KILDER: Kilde[] = [
  {
    navn: "Middellevetid",
    enhed: "år",
    retning: "hoejere_bedre",
    beskrivelse:
      "Forventet levetid for en nyfødt, beregnet ud fra dødeligheden i kommunen i 2021-2025 (Danmarks Statistik, HISBK). Afspejler både sundhed, livsstil og levevilkår blandt indbyggerne. Opgøres ikke for Fanø, Læsø, Samsø og Ærø, hvor befolkningen er for lille. En længere levetid giver en højere score.",
    tabel: "HISBK",
    omraadeVariabel: "OMRÅDE",
    variabler: { KØN: "TOT", Tid: "2021:2025" },
    maaMangle: true,
  },
  {
    navn: "Afstand til nærmeste læge",
    enhed: "km",
    retning: "lavere_bedre",
    beskrivelse:
      "Indbyggernes afstand i km til nærmeste praktiserende læge i 2024, i snit for alle i kommunen (Danmarks Statistik, SUNDAF01). Eksperimentel statistik. Det er ikke nødvendigvis den læge, man er tilknyttet. En kortere afstand giver en højere score.",
    tabel: "SUNDAF01",
    omraadeVariabel: "KOMMUNEDK",
    variabler: { BNØGLE: "0010", LIVSKONT: "2005", KØN: "00", ALDER: "IALT", Tid: "2024" },
    maaMangle: false,
  },
];

/** Tal pr. DST-kommunekode uden foranstillede nuller (fx "101"). Celler uden tal ("..")
 * springes over. */
async function hentTal(kilde: Kilde): Promise<Map<string, number>> {
  const svar = await fetch(DST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: kilde.tabel,
      format: "CSV",
      lang: "da",
      valuePresentation: "Code",
      variables: [
        { code: kilde.omraadeVariabel, values: ["*"] },
        ...Object.entries(kilde.variabler).map(([code, vaerdi]) => ({ code, values: [vaerdi] })),
      ],
    }),
  });
  if (!svar.ok) throw new Error(`${kilde.tabel}: HTTP ${svar.status} ${await svar.text()}`);

  const tal = new Map<string, number>();
  // Første linje er overskriften; området står først og værdien sidst (decimalkomma).
  for (const linje of (await svar.text()).trim().split("\n").slice(1)) {
    const felter = linje.trim().split(";");
    const vaerdi = Number(felter.at(-1)?.replace(",", "."));
    if (Number.isFinite(vaerdi)) tal.set(felter[0], vaerdi);
  }
  if (tal.size === 0) throw new Error(`${kilde.tabel}: svaret indeholdt ingen tal.`);
  return tal;
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);

  // Ny kategori sorteres efter de eksisterende.
  const [{ maksSortering }] = await db
    .select({ maksSortering: sql<number>`coalesce(max(${kategorier.sortering}), 0)` })
    .from(kategorier);

  const [kategori] = await db
    .insert(kategorier)
    .values({
      navn: KATEGORI_NAVN,
      slug: KATEGORI_SLUG,
      ikon: "heartbeat",
      standardvaegt: "1",
      sortering: Number(maksSortering) + 1,
    })
    .onConflictDoUpdate({ target: kategorier.slug, set: { navn: sql`excluded.navn` } })
    .returning();

  for (const kilde of KILDER) {
    const tal = await hentTal(kilde);
    const vaerdi = (kode: string) => tal.get(String(Number(kode)));

    const manglende = alleKommuner.filter((k) => vaerdi(k.kode) === undefined);
    if (manglende.length > 0 && !kilde.maaMangle) {
      throw new Error(`${kilde.navn}: mangler data for ${manglende.map((k) => k.navn).join(", ")}`);
    }

    // Genbrug eksisterende nøgletal ved genkørsel i stedet for at oprette dubletter.
    let [noegletalRow] = await db
      .select()
      .from(noegletal)
      .where(and(eq(noegletal.kategoriId, kategori.id), eq(noegletal.navn, kilde.navn)));
    if (!noegletalRow) {
      [noegletalRow] = await db
        .insert(noegletal)
        .values({
          kategoriId: kategori.id,
          navn: kilde.navn,
          enhed: kilde.enhed,
          retning: kilde.retning,
          beskrivelse: kilde.beskrivelse,
        })
        .returning();
    } else {
      await db
        .update(noegletal)
        .set({ beskrivelse: kilde.beskrivelse })
        .where(eq(noegletal.id, noegletalRow.id));
    }

    for (const kommune of alleKommuner) {
      const v = vaerdi(kommune.kode);
      if (v === undefined) continue;
      await db
        .insert(kommuneNoegletal)
        .values({ kommuneKode: kommune.kode, noegletalId: noegletalRow.id, vaerdi: v.toFixed(2) })
        .onConflictDoUpdate({
          target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
          set: { vaerdi: sql`excluded.vaerdi` },
        });
    }

    console.log(
      `${kilde.navn}: ${alleKommuner.length - manglende.length} kommuner` +
        (manglende.length > 0 ? ` (uden tal: ${manglende.map((k) => k.navn).join(", ")})` : ""),
    );
  }

  console.log(`Oprettede kategorien "${KATEGORI_NAVN}" med ${KILDER.length} nøgletal.`);
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
