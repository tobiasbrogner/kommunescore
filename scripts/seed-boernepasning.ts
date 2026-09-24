import "./_load-env";

import path from "node:path";
import * as XLSX from "xlsx";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KILDE_PATH = path.join(process.cwd(), "data/kilder/boernepasning-arstakster-2026.xlsx");

const KATEGORI_NAVN = "Børn";
const KATEGORI_SLUG = "boern";

const RAA_NOEGLETAL = [
  { kolonne: 2, navn: "Kommunal dagpleje (0-2 år)" },
  { kolonne: 3, navn: "Vuggestue (0-2 år)" },
  { kolonne: 4, navn: "Børnehave (3-5 år)" },
  { kolonne: 5, navn: "Skolefritidsordninger (6-9 år)" },
] as const;

const GENNEMSNIT_NAVN = "Gennemsnitspris årligt";

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

  const raaNoegletalRows = await Promise.all(
    RAA_NOEGLETAL.map(({ navn }) =>
      db
        .insert(noegletal)
        .values({ kategoriId: kategori.id, navn, enhed: "kr.", retning: "lavere_bedre" })
        .returning()
        .then(([row]) => row),
    ),
  );

  const [gennemsnitNoegletal] = await db
    .insert(noegletal)
    .values({
      kategoriId: kategori.id,
      navn: GENNEMSNIT_NAVN,
      enhed: "kr.",
      retning: "lavere_bedre",
    })
    .returning();

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
