import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal } from "@/lib/db/schema";
import { KategorierManager } from "@/components/panel/kategorier-manager";

export default async function PanelKategorierPage() {
  const [alleKategorier, alleKommuner, alleVaerdier] = await Promise.all([
    db.query.kategorier.findMany({
      orderBy: [asc(kategorier.sortering)],
      with: { noegletal: true },
    }),
    db
      .select({ kode: kommuner.kode, navn: kommuner.navn })
      .from(kommuner)
      .orderBy(asc(kommuner.navn)),
    db
      .select({
        kommuneKode: kommuneNoegletal.kommuneKode,
        noegletalId: kommuneNoegletal.noegletalId,
        vaerdi: kommuneNoegletal.vaerdi,
      })
      .from(kommuneNoegletal),
  ]);

  return (
    <KategorierManager
      initielleKategorier={alleKategorier}
      kommuner={alleKommuner}
      vaerdier={alleVaerdier}
    />
  );
}
