import "./_load-env";

import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

// BM010: realiserede handelspriser i kr. pr. m² for 2. kvartal 2026.
const KILDE_PATH = path.join(process.cwd(), "data/kilder/boligpriser-bm010.xlsx");
const NAVNEKOLONNE = 2;

// BM010 bruger stadig den gamle stavemåde for enkelte kommuner.
const NAVNE_ALIAS: Record<string, string> = { Århus: "Aarhus" };

const KATEGORI_NAVN = "Boligpriser";
const KATEGORI_SLUG = "boligpriser";

const KILDE_TEKST = "i 2. kvartal 2026 (Danmarks Statistik, BM010)";
const PRIS_SCORE_TEKST = "En lavere m²-pris giver en højere score.";

const NOEGLETAL = [
  {
    kolonne: 3,
    navn: "Parcel-/rækkehus",
    beskrivelse: `Gennemsnitlig realiseret handelspris pr. m² for parcel- og rækkehuse solgt i kommunen ${KILDE_TEKST}. Har en kommune for få handler til nogen opgørelse (fx Læsø), bruges landsdelens huspris. ${PRIS_SCORE_TEKST}`,
  },
  {
    kolonne: 4,
    navn: "Ejerlejlighed",
    beskrivelse: `Gennemsnitlig realiseret handelspris pr. m² for ejerlejligheder solgt i kommunen ${KILDE_TEKST}. Mange mindre kommuner har for få handler med ejerlejligheder til en opgørelse; så tæller kun husprisen. ${PRIS_SCORE_TEKST}`,
  },
] as const;

type Raekke = { navn: string; vaerdier: (number | null)[]; landsdel: string | null };

// ".." (diskretioneret) og 0 (ingen handler) behandles som manglende værdier.
function tilPris(raaVaerdi: unknown) {
  return typeof raaVaerdi === "number" && raaVaerdi > 0 ? raaVaerdi : null;
}

// Filen blander kommuner med "Hele landet", regioner og landsdele. Kommunerne står
// under deres landsdel, som huskes til kommuner helt uden opgjorte handler.
function laesRaekker(kommunenavne: Set<string>) {
  const arbejdsbog = XLSX.readFile(KILDE_PATH);
  const ark = arbejdsbog.Sheets[arbejdsbog.SheetNames[0]];
  const raa = XLSX.utils.sheet_to_json(ark, { header: 1, raw: true }) as unknown[][];

  const raekker: Raekke[] = [];
  const landsdelHuspris = new Map<string, number>();
  let landsdel: string | null = null;
  for (const linje of raa) {
    const raaNavn = linje[NAVNEKOLONNE];
    if (typeof raaNavn !== "string") continue;
    if (raaNavn.startsWith("Landsdel ")) {
      landsdel = raaNavn.trim();
      const huspris = tilPris(linje[NOEGLETAL[0].kolonne]);
      if (huspris !== null) landsdelHuspris.set(landsdel, huspris);
      continue;
    }
    const navn = NAVNE_ALIAS[raaNavn.trim()] ?? raaNavn.trim();
    if (!kommunenavne.has(navn)) continue;

    const vaerdier = NOEGLETAL.map(({ kolonne }) => tilPris(linje[kolonne]));
    raekker.push({ navn, vaerdier, landsdel });
  }
  return { raekker, landsdelHuspris };
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const kodePrNavn = new Map(alleKommuner.map((k) => [k.navn, k.kode]));
  const { raekker, landsdelHuspris } = laesRaekker(new Set(kodePrNavn.keys()));

  const fundne = new Set(raekker.map((r) => r.navn));
  const manglende = alleKommuner.filter((k) => !fundne.has(k.navn));
  if (manglende.length > 0) {
    throw new Error(`Mangler boligpriser for ${manglende.map((k) => k.navn).join(", ")}`);
  }

  // Uden nogen værdi ville kommunen få bundscoren 50; landsdelens huspris er et
  // bedre bud end det.
  const medLandsdelspris: string[] = [];
  for (const raekke of raekker) {
    if (raekke.vaerdier.some((v) => v !== null)) continue;
    const huspris = raekke.landsdel ? landsdelHuspris.get(raekke.landsdel) : undefined;
    if (huspris === undefined) {
      throw new Error(`Hverken hus-, lejligheds- eller landsdelspris for ${raekke.navn}`);
    }
    raekke.vaerdier[0] = huspris;
    medLandsdelspris.push(`${raekke.navn} (${raekke.landsdel})`);
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
      ikon: "home-dollar",
      standardvaegt: "1",
      sortering: Number(maksSortering) + 1,
    })
    .onConflictDoUpdate({ target: kategorier.slug, set: { navn: sql`excluded.navn` } })
    .returning();

  // Genbrug eksisterende nøgletal ved genkørsel i stedet for at oprette dubletter.
  const noegletalRows: (typeof noegletal.$inferSelect)[] = [];
  for (const { navn, beskrivelse } of NOEGLETAL) {
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
      .values({ kategoriId: kategori.id, navn, enhed: "kr./m²", retning: "lavere_bedre", beskrivelse })
      .returning();
    noegletalRows.push(ny);
  }

  let antalVaerdier = 0;
  for (const raekke of raekker) {
    const kode = kodePrNavn.get(raekke.navn)!;
    for (const [i, vaerdi] of raekke.vaerdier.entries()) {
      const noegletalId = noegletalRows[i].id;
      if (vaerdi === null) {
        // Fjern en evt. gammel værdi, hvis kommunen ikke længere har en opgørelse.
        await db
          .delete(kommuneNoegletal)
          .where(
            and(eq(kommuneNoegletal.kommuneKode, kode), eq(kommuneNoegletal.noegletalId, noegletalId)),
          );
        continue;
      }
      await db
        .insert(kommuneNoegletal)
        .values({ kommuneKode: kode, noegletalId, vaerdi: String(vaerdi) })
        .onConflictDoUpdate({
          target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
          set: { vaerdi: sql`excluded.vaerdi` },
        });
      antalVaerdier++;
    }
  }

  const udenHus = raekker.filter((r) => r.vaerdier[0] === null).map((r) => r.navn);
  const udenLejlighed = raekker.filter((r) => r.vaerdier[1] === null).length;
  console.log(
    `Oprettede kategorien "${KATEGORI_NAVN}" med ${NOEGLETAL.length} nøgletal og ${antalVaerdier} værdier for ${raekker.length} kommuner.`,
  );
  console.log(`Uden huspris: ${udenHus.join(", ") || "ingen"}. Uden lejlighedspris: ${udenLejlighed} kommuner.`);
  console.log(`Landsdelens huspris brugt for: ${medLandsdelspris.join(", ") || "ingen"}.`);
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
