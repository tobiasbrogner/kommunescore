import "./_load-env";

import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Jobmuligheder";
const KATEGORI_SLUG = "jobmuligheder";

type Kilde = {
  fil: string;
  navn: string;
  enhed: string;
  retning: "hoejere_bedre" | "lavere_bedre";
  beskrivelse: string;
  navneKolonne: number;
  vaerdiKolonne: number;
};

const KILDER: Kilde[] = [
  {
    fil: "data/kilder/erhvervsfrekvens.xlsx",
    navn: "Erhvervsfrekvens (16-64 år)",
    enhed: "%",
    retning: "hoejere_bedre",
    beskrivelse:
      "Andelen af 16-64-årige, der er i arbejdsstyrken (i job eller ledige), opgjort ultimo november 2024 (Danmarks Statistik, RAS200). En højere andel giver en højere score.",
    navneKolonne: 4,
    vaerdiKolonne: 5,
  },
  {
    fil: "data/kilder/job-pr-1000-indbyggere-2024.xlsx",
    navn: "Job pr. 1.000 indbyggere",
    enhed: "job",
    retning: "hoejere_bedre",
    beskrivelse:
      "Antal arbejdspladser i kommunen ultimo november 2024 pr. 1.000 indbyggere (Danmarks Statistik, ERHV2 og FOLK1AM). Tallet viser, hvor mange job der ligger i kommunen, ikke hvor indbyggerne arbejder. Flere job giver en højere score.",
    navneKolonne: 0,
    vaerdiKolonne: 3,
  },
  {
    fil: "data/kilder/ledighed.xlsx",
    navn: "Ledighed (fuldtidsledige)",
    enhed: "%",
    retning: "lavere_bedre",
    beskrivelse:
      "Fuldtidsledige i procent af arbejdsstyrken i 2024 (Danmarks Statistik, AULP01). En lavere ledighed giver en højere score.",
    navneKolonne: 2,
    vaerdiKolonne: 3,
  },
];

/** Læser (navn, værdi)-par fra første ark. Rækker der ikke er kommuner
 * (regioner, landsdele, "Hele landet", noter) frasorteres af kalderen, som kun
 * beholder navne der findes i kommuner-tabellen. */
function laesVaerdier(kilde: Kilde): Map<string, number> {
  const arbejdsbog = XLSX.readFile(path.join(process.cwd(), kilde.fil));
  const ark = arbejdsbog.Sheets[arbejdsbog.SheetNames[0]];
  const raa = XLSX.utils.sheet_to_json(ark, { header: 1, raw: true }) as unknown[][];

  const vaerdier = new Map<string, number>();
  for (const linje of raa) {
    const navn = linje[kilde.navneKolonne];
    const vaerdi = linje[kilde.vaerdiKolonne];
    if (typeof navn === "string" && typeof vaerdi === "number") {
      vaerdier.set(navn.trim(), vaerdi);
    }
  }
  return vaerdier;
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);

  const [kategori] = await db
    .insert(kategorier)
    .values({
      navn: KATEGORI_NAVN,
      slug: KATEGORI_SLUG,
      ikon: "briefcase",
      standardvaegt: "1",
      sortering: 2,
    })
    .onConflictDoUpdate({ target: kategorier.slug, set: { navn: sql`excluded.navn` } })
    .returning();

  let antalVaerdier = 0;

  for (const kilde of KILDER) {
    const vaerdier = laesVaerdier(kilde);

    const manglende = alleKommuner.filter((k) => !vaerdier.has(k.navn));
    if (manglende.length > 0) {
      throw new Error(
        `${kilde.fil}: mangler værdier for ${manglende.map((k) => k.navn).join(", ")}`,
      );
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
      await db
        .insert(kommuneNoegletal)
        .values({
          kommuneKode: kommune.kode,
          noegletalId: noegletalRow.id,
          vaerdi: String(vaerdier.get(kommune.navn)),
        })
        .onConflictDoUpdate({
          target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
          set: { vaerdi: sql`excluded.vaerdi` },
        });
      antalVaerdier++;
    }
  }

  console.log(
    `Oprettede kategorien "${KATEGORI_NAVN}" med ${KILDER.length} nøgletal og ${antalVaerdier} værdier for ${alleKommuner.length} kommuner.`,
  );
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
