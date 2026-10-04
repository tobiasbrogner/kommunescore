import "./_load-env";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Ældre";
const KATEGORI_SLUG = "aeldre";

// Tabellerne hentes direkte fra Statistikbankens API i stedet for downloadede filer.
const DST_API = "https://api.statbank.dk/v1/data";
const AAR = "2025";

/** Tal fra en Statistikbank-tabel pr. DST-kommunekode uden foranstillede nuller (fx
 * "101"). Kun ét tal pr. område må stå tilbage efter filtreringen. Celler uden tal ("..")
 * springes over. */
async function hentTal(tabel: string, variabler: Record<string, string[]>): Promise<Map<string, number>> {
  const svar = await fetch(DST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: tabel,
      format: "CSV",
      lang: "da",
      valuePresentation: "Code",
      variables: Object.entries(variabler).map(([code, values]) => ({ code, values })),
    }),
  });
  if (!svar.ok) throw new Error(`${tabel}: HTTP ${svar.status} ${await svar.text()}`);

  // Første linje er overskriften; værdien står sidst (decimalkomma).
  const linjer = (await svar.text()).trim().split("\n");
  const omraadeKolonne = linjer[0].trim().split(";").indexOf("OMRÅDE");
  if (omraadeKolonne === -1) throw new Error(`${tabel}: ingen OMRÅDE-kolonne i svaret.`);

  const tal = new Map<string, number>();
  for (const linje of linjer.slice(1)) {
    const felter = linje.trim().split(";");
    const vaerdi = Number(felter.at(-1)?.replace(",", "."));
    if (Number.isFinite(vaerdi)) tal.set(felter[omraadeKolonne], vaerdi);
  }
  if (tal.size === 0) throw new Error(`${tabel}: svaret indeholdt ingen tal.`);
  return tal;
}

type Noegletal = {
  navn: string;
  enhed: string;
  retning: "hoejere_bedre" | "lavere_bedre";
  beskrivelse: string;
  vaerdier: Map<string, number>;
};

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);

  // AED16: gennemsnitlig ventetid i dage til plejebolig for personer på 67 år og derover
  // på den generelle venteliste, som har fået tilbudt bolig i året.
  const ventetid = await hentTal("AED16", {
    MÆNGDE4: ["140"],
    OMRÅDE: ["*"],
    Tid: [AAR],
  });

  // AED021: visiterede timer hjemmehjælp i alt (personlig pleje og praktisk hjælp) pr.
  // uge pr. modtager på 67 år og derover.
  const hjemmehjaelp = await hentTal("AED021", {
    OMRÅDE: ["*"],
    YDELSESTYPE: ["450"],
    ALDER: ["850"],
    KOEN: ["100"],
    Tid: [AAR],
  });

  const NOEGLETAL: Noegletal[] = [
    {
      navn: "Ventetid på plejebolig",
      enhed: "dage",
      retning: "lavere_bedre",
      beskrivelse: `Gennemsnitlig ventetid i dage til plejehjem eller plejebolig i ${AAR} for personer på 67 år og derover på den generelle venteliste, som har fået tilbudt en bolig (Danmarks Statistik, AED16). Ventetiden kan svinge fra år til år, især i små kommuner med få pladser. En kortere ventetid giver en højere score.`,
      vaerdier: ventetid,
    },
    {
      navn: "Hjemmehjælp pr. modtager",
      enhed: "timer/uge",
      retning: "hoejere_bedre",
      beskrivelse: `Visiterede timer hjemmehjælp (personlig pleje og praktisk hjælp) pr. uge i ${AAR} for hver modtager på 67 år og derover (Danmarks Statistik, AED021). Viser, hvor meget hjælp kommunen giver den enkelte; mange timer kan også afspejle, at modtagerne er mere plejekrævende. Flere timer giver en højere score.`,
      vaerdier: hjemmehjaelp,
    },
  ];

  // Ny kategori sorteres efter de eksisterende; den endelige plads sættes af db:sorter.
  const [{ maksSortering }] = await db
    .select({ maksSortering: sql<number>`coalesce(max(${kategorier.sortering}), 0)` })
    .from(kategorier);

  const [kategori] = await db
    .insert(kategorier)
    .values({
      navn: KATEGORI_NAVN,
      slug: KATEGORI_SLUG,
      ikon: "old",
      standardvaegt: "1",
      sortering: Number(maksSortering) + 1,
    })
    .onConflictDoUpdate({ target: kategorier.slug, set: { navn: sql`excluded.navn` } })
    .returning();

  for (const n of NOEGLETAL) {
    const vaerdi = (kode: string) => n.vaerdier.get(String(Number(kode)));
    const manglende = alleKommuner.filter((k) => vaerdi(k.kode) === undefined);
    if (manglende.length > 0) {
      throw new Error(`${n.navn}: mangler data for ${manglende.map((k) => k.navn).join(", ")}`);
    }

    // Genbrug eksisterende nøgletal ved genkørsel i stedet for at oprette dubletter.
    let [noegletalRow] = await db
      .select()
      .from(noegletal)
      .where(and(eq(noegletal.kategoriId, kategori.id), eq(noegletal.navn, n.navn)));
    if (!noegletalRow) {
      [noegletalRow] = await db
        .insert(noegletal)
        .values({
          kategoriId: kategori.id,
          navn: n.navn,
          enhed: n.enhed,
          retning: n.retning,
          beskrivelse: n.beskrivelse,
        })
        .returning();
    } else {
      await db
        .update(noegletal)
        .set({ beskrivelse: n.beskrivelse })
        .where(eq(noegletal.id, noegletalRow.id));
    }

    for (const kommune of alleKommuner) {
      await db
        .insert(kommuneNoegletal)
        .values({
          kommuneKode: kommune.kode,
          noegletalId: noegletalRow.id,
          vaerdi: vaerdi(kommune.kode)!.toFixed(2),
        })
        .onConflictDoUpdate({
          target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
          set: { vaerdi: sql`excluded.vaerdi` },
        });
    }
  }

  console.log(
    `Oprettede kategorien "${KATEGORI_NAVN}" med ${NOEGLETAL.length} nøgletal for ${alleKommuner.length} kommuner.`,
  );
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
