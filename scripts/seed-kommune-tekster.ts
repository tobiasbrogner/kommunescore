import "./_load-env";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kommuner } from "@/lib/db/schema";
import { KOMMUNE_BESKRIVELSER } from "../data/kommune-beskrivelser";

// Udfylder "største by" og beskrivelse til rapportsiden fra data/kommune-beskrivelser.ts.
// Som standard udfyldes kun tomme felter, så rettelser fra admin-panelet bevares.
// Kør med --overskriv for at erstatte alt med teksterne i filen.
const OVERSKRIV = process.argv.includes("--overskriv");

async function main() {
  const alle = await db
    .select({
      kode: kommuner.kode,
      navn: kommuner.navn,
      stoersteBy: kommuner.stoersteBy,
      beskrivelse: kommuner.beskrivelse,
    })
    .from(kommuner);

  let opdateret = 0;
  const udenTekst: string[] = [];

  for (const kommune of alle) {
    const tekst = KOMMUNE_BESKRIVELSER[kommune.kode];
    if (!tekst) {
      udenTekst.push(kommune.navn);
      continue;
    }

    const aendringer: Partial<typeof kommuner.$inferInsert> = {};
    if (OVERSKRIV || !kommune.beskrivelse) aendringer.beskrivelse = tekst.beskrivelse;
    if ((OVERSKRIV || !kommune.stoersteBy) && tekst.stoersteBy) aendringer.stoersteBy = tekst.stoersteBy;
    if (Object.keys(aendringer).length === 0) continue;

    await db.update(kommuner).set(aendringer).where(eq(kommuner.kode, kommune.kode));
    opdateret++;
  }

  console.log(
    `Opdaterede tekster for ${opdateret} af ${alle.length} kommuner${OVERSKRIV ? " (overskrev eksisterende)" : " (kun tomme felter)"}.`,
  );
  if (udenTekst.length > 0) console.log(`Ingen tekst i filen for: ${udenTekst.join(", ")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
