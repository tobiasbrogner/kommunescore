import "./_load-env";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

// Kategoriernes rækkefølge på /kort og i rapporterne — det eneste sted, den
// er fastlagt. Seed-scripts sætter blot en foreløbig sortering; kør dette
// script bagefter (pnpm run db:sorter). Nye kategorier tilføjes her.
const RAEKKEFOELGE = [
  "boligpriser",
  "indbyggertal",
  "kommuneskat",
  "spisesteder",
  "natur",
  "idraet",
  "boern",
  "jobmuligheder",
  "tryghed",
  "sundhed",
  "aeldre",
  "pendling",
];

async function main() {
  const eksisterende = await db
    .select({ id: kategorier.id, slug: kategorier.slug, sortering: kategorier.sortering })
    .from(kategorier);
  const slugs = new Set(eksisterende.map((k) => k.slug));

  const mangler = RAEKKEFOELGE.filter((slug) => !slugs.has(slug));
  if (mangler.length > 0) {
    console.warn(`Findes ikke i databasen (springes over): ${mangler.join(", ")}`);
  }

  // Kategorier, der ikke står på listen, lægges bagerst i deres nuværende rækkefølge.
  const ukendte = eksisterende
    .filter((k) => !RAEKKEFOELGE.includes(k.slug))
    .sort((a, b) => a.sortering - b.sortering);
  if (ukendte.length > 0) {
    console.warn(
      `Ikke på listen i scripts/sorter-kategorier.ts (lægges bagerst): ${ukendte.map((k) => k.slug).join(", ")}`,
    );
  }

  const ordnet = [
    ...RAEKKEFOELGE.filter((slug) => slugs.has(slug)),
    ...ukendte.map((k) => k.slug),
  ];

  let aendret = 0;
  for (const [indeks, slug] of ordnet.entries()) {
    const kategori = eksisterende.find((k) => k.slug === slug)!;
    if (kategori.sortering === indeks + 1) continue;
    await db.update(kategorier).set({ sortering: indeks + 1 }).where(eq(kategorier.id, kategori.id));
    aendret++;
  }

  console.log(
    aendret === 0
      ? `Rækkefølgen var allerede korrekt (${ordnet.length} kategorier).`
      : `Opdaterede sorteringen for ${aendret} af ${ordnet.length} kategorier.`,
  );
  if (aendret > 0) await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
