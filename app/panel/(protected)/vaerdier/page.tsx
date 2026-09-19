import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { kommuner, kommuneNoegletal } from "@/lib/db/schema";
import { VaerdiTabel } from "@/components/panel/vaerdi-tabel";

export default async function PanelVaerdierPage() {
  const [alleKommuner, alleNoegletal, alleVaerdier] = await Promise.all([
    db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner).orderBy(asc(kommuner.navn)),
    db.query.noegletal.findMany({ with: { kategori: true } }),
    db
      .select({
        kommuneKode: kommuneNoegletal.kommuneKode,
        noegletalId: kommuneNoegletal.noegletalId,
        vaerdi: kommuneNoegletal.vaerdi,
      })
      .from(kommuneNoegletal),
  ]);

  if (alleNoegletal.length === 0) {
    return (
      <p className="text-sm text-muted">
        Der er ingen nøgletal endnu — opret mindst ét under{" "}
        <span className="font-medium text-foreground">Kategorier &amp; nøgletal</span>, før du kan
        indtaste værdier.
      </p>
    );
  }

  return (
    <VaerdiTabel kommuner={alleKommuner} noegletal={alleNoegletal} vaerdier={alleVaerdier} />
  );
}
