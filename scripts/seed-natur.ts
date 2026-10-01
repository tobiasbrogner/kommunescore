import "./_load-env";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Natur";
const KATEGORI_SLUG = "natur";

// AREALDK2 hentes direkte fra Statistikbankens API i stedet for en downloadet fil.
const DST_API = "https://api.statbank.dk/v1/data";
const TABEL = "AREALDK2";
const AAR = "2024";

// Arealdække, der tæller som natur og grønne områder: skov, lysåben natur (heder,
// klitter, enge, moser), søer og vandløb samt parker, kirkegårde og andre rekreative
// områder — de sidste, så byernes grønne områder også tæller med.
const NATUR_TYPER = ["C2", "E", "F1", "F2", "G1", "G2"];
const SAMLET_AREAL = "TOT";
const ENHED_KM2 = "8120";
const ENHED_M2_PR_INDBYGGER = "8130";

type Noegletal = {
  navn: string;
  enhed: string;
  skala: "lineaer" | "logaritmisk";
  standardValgt: boolean;
  beskrivelse: string;
  beregn: (kode: string) => number | undefined;
};

/** Værdier fra AREALDK2 som "arealdække;område;enhed" → tal. Området er DST's
 * kommunekode uden foranstillede nuller (fx "101"). */
async function hentArealdaekke(): Promise<Map<string, number>> {
  const svar = await fetch(DST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: TABEL,
      format: "CSV",
      lang: "da",
      valuePresentation: "Code",
      variables: [
        { code: "ARE1", values: [SAMLET_AREAL, ...NATUR_TYPER] },
        { code: "OMRÅDE", values: ["*"] },
        { code: "ENHED", values: [ENHED_KM2, ENHED_M2_PR_INDBYGGER] },
        { code: "Tid", values: [AAR] },
      ],
    }),
  });
  if (!svar.ok) throw new Error(`${TABEL}: HTTP ${svar.status} ${await svar.text()}`);

  const vaerdier = new Map<string, number>();
  // Første linje er overskriften: ARE1;OMRÅDE;ENHED;TID;INDHOLD (decimalkomma).
  for (const linje of (await svar.text()).trim().split("\n").slice(1)) {
    const [type, omraade, enhed, , indhold] = linje.trim().split(";");
    const tal = Number(indhold?.replace(",", "."));
    if (Number.isFinite(tal)) vaerdier.set(`${type};${omraade};${enhed}`, tal);
  }
  if (vaerdier.size === 0) throw new Error(`${TABEL}: svaret indeholdt ingen tal.`);
  return vaerdier;
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const areal = await hentArealdaekke();

  const dstKode = (kode: string) => String(Number(kode));
  const summerNatur = (kode: string, enhed: string) => {
    const dele = NATUR_TYPER.map((type) => areal.get(`${type};${dstKode(kode)};${enhed}`));
    return dele.every((d) => d !== undefined) ? dele.reduce((a, b) => a! + b!, 0) : undefined;
  };

  const NOEGLETAL: Noegletal[] = [
    {
      navn: "Andel natur og grønne områder",
      enhed: "%",
      skala: "lineaer",
      standardValgt: true,
      beskrivelse: `Andelen af kommunens areal, der er skov, heder, klitter, enge, moser, søer, vandløb eller parker og andre rekreative områder, opgjort i ${AAR} (Danmarks Statistik, ${TABEL}). Landbrugsjord tæller ikke med. En højere andel giver en højere score.`,
      beregn: (kode) => {
        const natur = summerNatur(kode, ENHED_KM2);
        const samlet = areal.get(`${SAMLET_AREAL};${dstKode(kode)};${ENHED_KM2}`);
        return natur !== undefined && samlet ? (natur / samlet) * 100 : undefined;
      },
    },
    {
      navn: "Natur pr. indbygger",
      enhed: "m²",
      skala: "logaritmisk",
      standardValgt: false,
      beskrivelse: `Kvadratmeter skov, lysåben natur, søer, vandløb, parker og andre rekreative områder pr. indbygger i ${AAR} (Danmarks Statistik, ${TABEL}). Viser, hvor meget natur der er at dele, så tyndt befolkede kommuner ligger højt. Mere natur pr. indbygger giver en højere score.`,
      beregn: (kode) => summerNatur(kode, ENHED_M2_PR_INDBYGGER),
    },
  ];

  // Ny kategori sorteres efter de eksisterende.
  const [{ maksSortering }] = await db
    .select({ maksSortering: sql<number>`coalesce(max(${kategorier.sortering}), 0)` })
    .from(kategorier);

  const [kategori] = await db
    .insert(kategorier)
    .values({
      navn: KATEGORI_NAVN,
      slug: KATEGORI_SLUG,
      ikon: "trees",
      standardvaegt: "1",
      sortering: Number(maksSortering) + 1,
    })
    .onConflictDoUpdate({ target: kategorier.slug, set: { navn: sql`excluded.navn` } })
    .returning();

  for (const n of NOEGLETAL) {
    const vaerdier = new Map(alleKommuner.map((k) => [k.kode, n.beregn(k.kode)]));
    const manglende = alleKommuner.filter((k) => vaerdier.get(k.kode) === undefined);
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
          retning: "hoejere_bedre",
          skala: n.skala,
          standardValgt: n.standardValgt,
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
          vaerdi: vaerdier.get(kommune.kode)!.toFixed(2),
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
