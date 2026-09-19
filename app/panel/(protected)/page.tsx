import { Card } from "@heroui/react";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kommuner, kategorier, noegletal, kommuneNoegletal } from "@/lib/db/schema";

export default async function PanelOverblikPage() {
  const [[{ antalKommuner }], [{ antalKategorier }], [{ antalNoegletal }], [{ antalVaerdier }]] =
    await Promise.all([
      db.select({ antalKommuner: sql<number>`count(*)::int` }).from(kommuner),
      db.select({ antalKategorier: sql<number>`count(*)::int` }).from(kategorier),
      db.select({ antalNoegletal: sql<number>`count(*)::int` }).from(noegletal),
      db.select({ antalVaerdier: sql<number>`count(*)::int` }).from(kommuneNoegletal),
    ]);

  const forventetAntalVaerdier = antalKommuner * antalNoegletal;
  const manglerVaerdier = Math.max(forventetAntalVaerdier - antalVaerdier, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border border-border/80 bg-background">
        <Card.Content className="p-5">
          <p className="text-sm text-muted">Kommuner</p>
          <p className="mt-1 text-3xl font-semibold">{antalKommuner}</p>
        </Card.Content>
      </Card>
      <Card className="border border-border/80 bg-background">
        <Card.Content className="p-5">
          <p className="text-sm text-muted">Kategorier</p>
          <p className="mt-1 text-3xl font-semibold">{antalKategorier}</p>
        </Card.Content>
      </Card>
      <Card className="border border-border/80 bg-background">
        <Card.Content className="p-5">
          <p className="text-sm text-muted">Nøgletal</p>
          <p className="mt-1 text-3xl font-semibold">{antalNoegletal}</p>
        </Card.Content>
      </Card>
      <Card className="border border-border/80 bg-background">
        <Card.Content className="p-5">
          <p className="text-sm text-muted">Manglende værdier</p>
          <p className="mt-1 text-3xl font-semibold">{manglerVaerdier}</p>
        </Card.Content>
      </Card>
    </div>
  );
}
