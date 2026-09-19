import { db } from "@/lib/db";
import { kategorier } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { KategorierManager } from "@/components/panel/kategorier-manager";

export default async function PanelKategorierPage() {
  const alleKategorier = await db.query.kategorier.findMany({
    orderBy: [asc(kategorier.sortering)],
    with: { noegletal: true },
  });

  return <KategorierManager initielleKategorier={alleKategorier} />;
}
