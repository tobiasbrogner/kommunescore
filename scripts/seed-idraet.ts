import "./_load-env";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Idræt og fritid";
const KATEGORI_SLUG = "idraet";

// Tabellerne hentes direkte fra Statistikbankens API i stedet for downloadede filer.
const DST_API = "https://api.statbank.dk/v1/data";
const AAR = "2025";

/** Tal fra en Statistikbank-tabel pr. nøgle af de første `noeglefelter` kolonner (fx
 * "101" eller "101;FAC4"), med DST's kommunekode uden foranstillede nuller. Celler uden
 * tal ("..") springes over. */
async function hentTal(
  tabel: string,
  variabler: Record<string, string[]>,
  noeglefelter = 1,
): Promise<Map<string, number>> {
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

  const tal = new Map<string, number>();
  // Første linje er overskriften; værdien står sidst (decimalkomma).
  for (const linje of (await svar.text()).trim().split("\n").slice(1)) {
    const felter = linje.trim().split(";");
    const vaerdi = Number(felter.at(-1)?.replace(",", "."));
    if (Number.isFinite(vaerdi)) tal.set(felter.slice(0, noeglefelter).join(";"), vaerdi);
  }
  if (tal.size === 0) throw new Error(`${tabel}: svaret indeholdt ingen tal.`);
  return tal;
}

type Noegletal = {
  navn: string;
  enhed: string;
  beskrivelse: string;
  vaerdier: Map<string, number>;
};

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);

  // IDRAKT02: medlemskaber af idrætsforeninger i procent af befolkningen.
  const medlemskaber = await hentTal("IDRAKT02", {
    BLSTKOM: ["*"],
    KON: ["10"],
    ALDER1: ["TOT"],
    Tid: [AAR],
  });

  // IDRFAC01: antal idrætsfaciliteter pr. type; alle typer lægges sammen. Typer uden tal
  // for en kommune tæller som 0.
  const faciliteter = await hentTal(
    "IDRFAC01",
    { OMRÅDE: ["*"], IDRFAC: ["*"], Tid: [AAR] },
    2,
  );
  const anlaegIAlt = new Map<string, number>();
  for (const [noegle, antal] of faciliteter) {
    const omraade = noegle.split(";")[0];
    anlaegIAlt.set(omraade, (anlaegIAlt.get(omraade) ?? 0) + antal);
  }

  // FOLK1A: befolkningen 1. januar samme år som faciliteterne.
  const befolkning = await hentTal("FOLK1A", {
    OMRÅDE: ["*"],
    KØN: ["TOT"],
    ALDER: ["IALT"],
    CIVILSTAND: ["TOT"],
    Tid: [`${AAR}K1`],
  });

  const anlaegPrTiTusind = new Map(
    [...anlaegIAlt].flatMap(([omraade, antal]) => {
      const indbyggere = befolkning.get(omraade);
      return indbyggere ? [[omraade, (antal / indbyggere) * 10000] as const] : [];
    }),
  );

  const NOEGLETAL: Noegletal[] = [
    {
      navn: "Medlemskaber af idrætsforeninger",
      enhed: "%",
      beskrivelse: `Medlemskaber af idrætsforeninger og -organisationer i ${AAR} i procent af befolkningen (Danmarks Statistik, IDRAKT02). Én person kan være medlem af flere foreninger, så tallet kan komme over 100 %. Viser, hvor stort foreningslivet er. Flere medlemskaber giver en højere score.`,
      vaerdier: medlemskaber,
    },
    {
      navn: "Idrætsanlæg pr. 10.000 indbyggere",
      enhed: "anlæg",
      beskrivelse: `Antal idrætsfaciliteter i ${AAR}, fx haller, fodboldanlæg, svømmehaller, fitnesscentre og padelbaner, pr. 10.000 indbyggere (Danmarks Statistik, IDRFAC01 og FOLK1A). Små kommuner ligger ofte højt, fordi selv få anlæg deles af få indbyggere. Flere anlæg giver en højere score.`,
      vaerdier: anlaegPrTiTusind,
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
      ikon: "ball-football",
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
          retning: "hoejere_bedre",
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
