import "./_load-env";

import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KILDE_PATH = path.join(process.cwd(), "data/kilder/boernepasning-arstakster-2026.xlsx");

const KATEGORI_NAVN = "Børn";
const KATEGORI_SLUG = "boern";

const KILDE_TEKST = "pr. 1. januar 2026 (Danmarks Statistik, RES88)";
const PRIS_SCORE_TEKST = "En lavere pris giver en højere score.";

const RAA_NOEGLETAL = [
  {
    kolonne: 2,
    navn: "Kommunal dagpleje (0-2 år)",
    beskrivelse: `Årlig takst for kommunal dagpleje inkl. frokost ${KILDE_TEKST}. Søskenderabat mv. kan gøre forældrebetalingen lavere. ${PRIS_SCORE_TEKST}`,
  },
  {
    kolonne: 3,
    navn: "Vuggestue (0-2 år)",
    beskrivelse: `Årlig takst for en plads i vuggestue ${KILDE_TEKST}. Søskenderabat mv. kan gøre forældrebetalingen lavere. ${PRIS_SCORE_TEKST}`,
  },
  {
    kolonne: 4,
    navn: "Børnehave (3-5 år)",
    beskrivelse: `Årlig takst for en plads i børnehave ${KILDE_TEKST}. Søskenderabat mv. kan gøre forældrebetalingen lavere. ${PRIS_SCORE_TEKST}`,
  },
  {
    kolonne: 5,
    navn: "Skolefritidsordninger (6-9 år)",
    beskrivelse: `Årlig takst for en plads i SFO for 6-9-årige ${KILDE_TEKST}. ${PRIS_SCORE_TEKST}`,
  },
] as const;

const GENNEMSNIT_NAVN = "Gennemsnitspris årligt";
const GENNEMSNIT_BESKRIVELSE = `Gennemsnittet af kommunens årstakster for dagpleje, vuggestue, børnehave og SFO ${KILDE_TEKST}. Pasningstyper, kommunen ikke har, tæller ikke med. ${PRIS_SCORE_TEKST}`;

type Raekke = { navn: string; vaerdier: (number | null)[] };

function laesRaekker(): Raekke[] {
  const arbejdsbog = XLSX.readFile(KILDE_PATH);
  const ark = arbejdsbog.Sheets[arbejdsbog.SheetNames[0]];
  const raa = XLSX.utils.sheet_to_json(ark, { header: 1, raw: true }) as unknown[][];

  const raekker: Raekke[] = [];
  for (const linje of raa) {
    const navn = linje[1];
    if (typeof navn !== "string" || navn === "Hele landet") continue;

    const vaerdier = RAA_NOEGLETAL.map(({ kolonne }) => {
      const raaVaerdi = linje[kolonne];
      return typeof raaVaerdi === "number" ? raaVaerdi : null;
    });
    raekker.push({ navn, vaerdier });
  }
  return raekker;
}

async function main() {
  const raekker = laesRaekker();
  if (raekker.length !== 98) {
    throw new Error(`Forventede 98 kommuner i kildefilen, fandt ${raekker.length}.`);
  }

  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);
  const kodePrNavn = new Map(alleKommuner.map((k) => [k.navn, k.kode]));

  const manglende = raekker.filter((r) => !kodePrNavn.has(r.navn));
  if (manglende.length > 0) {
    throw new Error(
      `Kunne ikke matche kommune-navne: ${manglende.map((r) => r.navn).join(", ")}`,
    );
  }

  const [kategori] = await db
    .insert(kategorier)
    .values({ navn: KATEGORI_NAVN, slug: KATEGORI_SLUG, standardvaegt: "1", sortering: 1 })
    .onConflictDoUpdate({ target: kategorier.slug, set: { navn: sql`excluded.navn` } })
    .returning();

  // Genbrug eksisterende nøgletal ved genkørsel i stedet for at oprette dubletter.
  const hentEllerOpretNoegletal = async (navn: string, beskrivelse: string) => {
    const [eksisterende] = await db
      .select()
      .from(noegletal)
      .where(and(eq(noegletal.kategoriId, kategori.id), eq(noegletal.navn, navn)));
    if (eksisterende) {
      await db.update(noegletal).set({ beskrivelse }).where(eq(noegletal.id, eksisterende.id));
      return eksisterende;
    }
    const [ny] = await db
      .insert(noegletal)
      .values({ kategoriId: kategori.id, navn, enhed: "kr.", retning: "lavere_bedre", beskrivelse })
      .returning();
    return ny;
  };

  const raaNoegletalRows: (typeof noegletal.$inferSelect)[] = [];
  for (const { navn, beskrivelse } of RAA_NOEGLETAL) {
    raaNoegletalRows.push(await hentEllerOpretNoegletal(navn, beskrivelse));
  }
  const gennemsnitNoegletal = await hentEllerOpretNoegletal(GENNEMSNIT_NAVN, GENNEMSNIT_BESKRIVELSE);

  const indsaettelser: { kommuneKode: string; noegletalId: number; vaerdi: string }[] = [];

  for (const raekke of raekker) {
    const kode = kodePrNavn.get(raekke.navn)!;

    raekke.vaerdier.forEach((vaerdi, i) => {
      if (vaerdi === null) return;
      indsaettelser.push({
        kommuneKode: kode,
        noegletalId: raaNoegletalRows[i].id,
        vaerdi: String(vaerdi),
      });
    });

    const tilstedevaerende = raekke.vaerdier.filter((v): v is number => v !== null);
    const gennemsnit = tilstedevaerende.reduce((a, b) => a + b, 0) / tilstedevaerende.length;
    indsaettelser.push({
      kommuneKode: kode,
      noegletalId: gennemsnitNoegletal.id,
      vaerdi: String(Math.round(gennemsnit)),
    });
  }

  for (const raekke of indsaettelser) {
    await db
      .insert(kommuneNoegletal)
      .values(raekke)
      .onConflictDoUpdate({
        target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
        set: { vaerdi: sql`excluded.vaerdi` },
      });
  }

  console.log(
    `Oprettede kategorien "${KATEGORI_NAVN}" med ${RAA_NOEGLETAL.length + 1} nøgletal og ${indsaettelser.length} værdier for ${raekker.length} kommuner.`,
  );
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
