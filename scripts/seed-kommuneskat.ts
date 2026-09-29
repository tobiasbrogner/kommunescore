import "./_load-env";

import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

// PSKAT: kommunal udskrivningsprocent og grundskyldspromille for 2026. Tallene for
// grundskyld er de samme som i EJDSK2.
const KILDE_PATH = path.join(process.cwd(), "data/kilder/kommuneskat-pskat.xlsx");
const NAVNEKOLONNE = 1;

const KATEGORI_NAVN = "Kommuneskat";
const KATEGORI_SLUG = "kommuneskat";

const KILDE_TEKST = "for 2026 (Danmarks Statistik, PSKAT)";
const SKAT_SCORE_TEKST = "En lavere sats giver en højere score.";

const NOEGLETAL = [
  {
    kolonne: 2,
    navn: "Kommuneskat",
    enhed: "%",
    beskrivelse: `Kommunal udskrivningsprocent ${KILDE_TEKST}, dvs. den andel af den skattepligtige indkomst, der betales i kommuneskat. Kirkeskat er ikke medregnet. ${SKAT_SCORE_TEKST}`,
  },
  {
    kolonne: 3,
    navn: "Grundskyldspromille",
    enhed: "‰",
    beskrivelse: `Kommunens grundskyldspromille ${KILDE_TEKST}, dvs. den årlige skat i promille af grundværdien, som boligejere betaler af deres grund. ${SKAT_SCORE_TEKST}`,
  },
] as const;

type Raekke = { navn: string; vaerdier: (number | null)[] };

// Filen blander kommuner med "Hele landet" og regioner; kun kommunerne tages med.
function laesRaekker(kommunenavne: Set<string>): Raekke[] {
  const arbejdsbog = XLSX.readFile(KILDE_PATH);
  const ark = arbejdsbog.Sheets[arbejdsbog.SheetNames[0]];
  const raa = XLSX.utils.sheet_to_json(ark, { header: 1, raw: true }) as unknown[][];

  const raekker: Raekke[] = [];
  for (const linje of raa) {
    const raaNavn = linje[NAVNEKOLONNE];
    if (typeof raaNavn !== "string") continue;
    const navn = raaNavn.trim();
    if (!kommunenavne.has(navn)) continue;

    const vaerdier = NOEGLETAL.map(({ kolonne }) => {
      const raaVaerdi = linje[kolonne];
      return typeof raaVaerdi === "number" ? raaVaerdi : null;
    });
    raekker.push({ navn, vaerdier });
  }
  return raekker;
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const kodePrNavn = new Map(alleKommuner.map((k) => [k.navn, k.kode]));
  const raekker = laesRaekker(new Set(kodePrNavn.keys()));

  const fundne = new Set(raekker.map((r) => r.navn));
  const manglende = alleKommuner.filter((k) => !fundne.has(k.navn));
  if (manglende.length > 0) {
    throw new Error(`Mangler skattesatser for ${manglende.map((k) => k.navn).join(", ")}`);
  }
  const udenVaerdi = raekker.filter((r) => r.vaerdier.some((v) => v === null));
  if (udenVaerdi.length > 0) {
    throw new Error(`Ufuldstændige skattesatser for ${udenVaerdi.map((r) => r.navn).join(", ")}`);
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
      ikon: "receipt-tax",
      standardvaegt: "1",
      sortering: Number(maksSortering) + 1,
    })
    .onConflictDoUpdate({ target: kategorier.slug, set: { navn: sql`excluded.navn` } })
    .returning();

  // Genbrug eksisterende nøgletal ved genkørsel i stedet for at oprette dubletter.
  const noegletalRows: (typeof noegletal.$inferSelect)[] = [];
  for (const { navn, enhed, beskrivelse } of NOEGLETAL) {
    const [eksisterende] = await db
      .select()
      .from(noegletal)
      .where(and(eq(noegletal.kategoriId, kategori.id), eq(noegletal.navn, navn)));
    if (eksisterende) {
      await db.update(noegletal).set({ beskrivelse }).where(eq(noegletal.id, eksisterende.id));
      noegletalRows.push(eksisterende);
      continue;
    }
    const [ny] = await db
      .insert(noegletal)
      .values({ kategoriId: kategori.id, navn, enhed, retning: "lavere_bedre", beskrivelse })
      .returning();
    noegletalRows.push(ny);
  }

  let antalVaerdier = 0;
  for (const raekke of raekker) {
    const kode = kodePrNavn.get(raekke.navn)!;
    for (const [i, vaerdi] of raekke.vaerdier.entries()) {
      await db
        .insert(kommuneNoegletal)
        .values({ kommuneKode: kode, noegletalId: noegletalRows[i].id, vaerdi: String(vaerdi) })
        .onConflictDoUpdate({
          target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
          set: { vaerdi: sql`excluded.vaerdi` },
        });
      antalVaerdier++;
    }
  }

  console.log(
    `Oprettede kategorien "${KATEGORI_NAVN}" med ${NOEGLETAL.length} nøgletal og ${antalVaerdier} værdier for ${raekker.length} kommuner.`,
  );
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
