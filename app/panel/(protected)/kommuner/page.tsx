import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { kommuner } from "@/lib/db/schema";
import { KommunerManager } from "@/components/panel/kommuner-manager";

export default async function PanelKommunerPage() {
  const alleKommuner = await db
    .select({
      kode: kommuner.kode,
      navn: kommuner.navn,
      stoersteBy: kommuner.stoersteBy,
      beskrivelse: kommuner.beskrivelse,
    })
    .from(kommuner)
    .orderBy(asc(kommuner.navn));

  return <KommunerManager kommuner={alleKommuner} />;
}
