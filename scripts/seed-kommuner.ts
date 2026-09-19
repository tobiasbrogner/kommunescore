import "./_load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kommuner } from "@/lib/db/schema";

async function main() {
  const geojsonPath = path.join(process.cwd(), "public/data/kommuner.geojson");
  const raa = await readFile(geojsonPath, "utf-8");
  const data = JSON.parse(raa) as GeoJSON.FeatureCollection;

  const rows = data.features.map((feature) => ({
    kode: String(feature.properties?.kode),
    navn: String(feature.properties?.navn),
  }));

  if (rows.length === 0) {
    throw new Error("Fandt ingen kommuner i public/data/kommuner.geojson");
  }

  await db
    .insert(kommuner)
    .values(rows)
    .onConflictDoUpdate({
      target: kommuner.kode,
      set: { navn: sql`excluded.navn` },
    });

  console.log(`Seedede/opdaterede ${rows.length} kommuner.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
