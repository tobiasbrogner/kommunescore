import "./_load-env";

import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Tryghed";
const KATEGORI_SLUG = "tryghed";

// STRAF11: anmeldte forbrydelser pr. kvartal i 2025 efter overtrædelsens art og kommune,
// hentet fra Danmarks Statistiks API (api.statbank.dk/v1/data, tabel STRAF11, format BULK,
// OVERTRÆD 1, 12, 1210, 1220, 1283, 1320, 1380, 1390, 1332, 1345, Tid 2025K1-2025K4).
// Kolonner: OMRÅDE;OVERTRÆD;TID;INDHOLD. Kvartalerne lægges sammen til et helt år.
const FORBRYDELSE_KILDE = "data/kilder/straf11-typer-2025.csv";
const AAR = "2025";

// FOLK1AM: befolkningen 1. december 2024 (samme fil som Spisesteder bruger).
const BEFOLKNING_KILDE = "data/kilder/befolkning-folk1am.xlsx";
const BEFOLKNING_NAVNEKOLONNE = 2;
const BEFOLKNING_VAERDIKOLONNE = 3;

const FAELLES =
  "Tæller hvor forbrydelsen er begået, og anmeldelser uden oplyst kommune er ikke med.";

type Noegletal = {
  navn: string;
  // Tæller i kategoriens standardscore; ellers et tilvalg under Prioritet på /kort.
  standardValgt: boolean;
  beskrivelse: string;
  // Årets antal for en kommune ud fra antal pr. art (artens navn i STRAF11).
  antal: (art: (navn: string) => number) => number;
};

// Indbrud og vold mod personer er det, der rammer beboerne. Alle anmeldelser tilsammen
// domineres af butikstyverier, bedrageri og nattelivet i bymidter, så storbyer fik
// bundscoren uanset hvor trygt der er at bo; det er nu et tilvalg.
const NOEGLETAL: Noegletal[] = [
  {
    navn: "Indbrud i beboelser pr. 1.000 indbyggere",
    standardValgt: true,
    beskrivelse: `Anmeldte indbrud i private boliger i hele ${AAR} pr. 1.000 indbyggere (Danmarks Statistik, STRAF11 og FOLK1AM). ${FAELLES} Færre indbrud giver en højere score.`,
    antal: (art) => art("Indbrud i beboelser"),
  },
  {
    navn: "Vold og røveri pr. 1.000 indbyggere",
    standardValgt: true,
    beskrivelse: `Anmeldt vold, trusler og røveri mod personer i hele ${AAR} pr. 1.000 indbyggere (Danmarks Statistik, STRAF11 og FOLK1AM). Vold mod politi og myndigheder, opløb og uagtsom legemsbeskadigelse er ikke med, da de mest afspejler nattelivet og politiets indsats. ${FAELLES} Færre anmeldelser giver en højere score.`,
    antal: (art) =>
      art("Voldsforbrydelser i alt") -
      art("Vold og lignende mod offentlig myndighed") -
      art("Opløb/forstyrrelse af offentlig orden") -
      art("Uagtsomt manddrab/legemsbeskadigelse") +
      art("Røveri"),
  },
  {
    navn: "Anmeldte forbrydelser pr. 1.000 indbyggere",
    standardValgt: false,
    beskrivelse: `Alle anmeldte straffelovsforbrydelser (fx vold, indbrud, tyveri og bedrageri) i hele ${AAR} pr. 1.000 indbyggere (Danmarks Statistik, STRAF11 og FOLK1AM). Særlove som narko-, våben- og udlændingeloven er ikke med. Butikstyverier og nattelivet trækker bymidter op. ${FAELLES} Færre anmeldelser giver en højere score.`,
    antal: (art) => art("Straffelov i alt"),
  },
];

/** Tal pr. område-navn. Rækker der ikke er kommuner frasorteres senere, fordi kun
 * navne fra kommuner-tabellen slås op. */
function laesBefolkning(): Map<string, number> {
  const arbejdsbog = XLSX.readFile(path.join(process.cwd(), BEFOLKNING_KILDE));
  const ark = arbejdsbog.Sheets[arbejdsbog.SheetNames[0]];
  const raa = XLSX.utils.sheet_to_json(ark, { header: 1, raw: true }) as unknown[][];
  const tal = new Map<string, number>();
  for (const linje of raa) {
    const navn = linje[BEFOLKNING_NAVNEKOLONNE];
    const vaerdi = linje[BEFOLKNING_VAERDIKOLONNE];
    if (typeof navn === "string" && typeof vaerdi === "number") tal.set(navn.trim(), vaerdi);
  }
  return tal;
}

/** Årets antal anmeldelser pr. "område|art". BULK-formatet udelader rækker med 0, så
 * en manglende kombination tæller som 0; filen skal dog have alle fire kvartaler. */
function laesForbrydelser(): Map<string, number> {
  const linjer = readFileSync(path.join(process.cwd(), FORBRYDELSE_KILDE), "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1);
  const antal = new Map<string, number>();
  const kvartaler = new Set<string>();
  for (const linje of linjer) {
    const [omraade, art, tid, vaerdi] = linje.split(";");
    if (!tid?.startsWith(AAR)) continue;
    kvartaler.add(tid);
    const noegle = `${omraade}|${art}`;
    // ".." betyder uoplyst hos Danmarks Statistik; tælles som 0.
    antal.set(noegle, (antal.get(noegle) ?? 0) + (Number(vaerdi) || 0));
  }
  if (kvartaler.size !== 4) {
    throw new Error(`${FORBRYDELSE_KILDE}: har ${kvartaler.size} kvartaler i ${AAR}, ikke 4.`);
  }
  return antal;
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const forbrydelser = laesForbrydelser();
  const befolkning = laesBefolkning();

  const manglende = alleKommuner.filter(
    (k) => !forbrydelser.has(`${k.navn}|Straffelov i alt`) || !befolkning.get(k.navn),
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

  for (const n of NOEGLETAL) {
    const felter = {
      enhed: "anmeldelser",
      retning: "lavere_bedre" as const,
      standardValgt: n.standardValgt,
      beskrivelse: n.beskrivelse,
    };

    // Genbrug eksisterende nøgletal ved genkørsel i stedet for at oprette dubletter.
    let [noegletalRow] = await db
      .select()
      .from(noegletal)
      .where(and(eq(noegletal.kategoriId, kategori.id), eq(noegletal.navn, n.navn)));
    if (!noegletalRow) {
      [noegletalRow] = await db
        .insert(noegletal)
        .values({ kategoriId: kategori.id, navn: n.navn, ...felter })
        .returning();
    } else {
      await db.update(noegletal).set(felter).where(eq(noegletal.id, noegletalRow.id));
    }

    for (const kommune of alleKommuner) {
      const antal = n.antal((art) => forbrydelser.get(`${kommune.navn}|${art}`) ?? 0);
      const prTusind = (antal / befolkning.get(kommune.navn)!) * 1000;
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
  }

  console.log(
    `Opdaterede kategorien "${KATEGORI_NAVN}" med ${NOEGLETAL.length} nøgletal for ${alleKommuner.length} kommuner.`,
  );
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
