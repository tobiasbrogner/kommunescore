import "./_load-env";

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { kommuner } from "@/lib/db/schema";

// Finder et punkt for hver kommune, som den personlige afstand på /kort måles fra:
// koordinaterne på kommunens største by. Det rammer bedre, hvor folk bor, end kommunens
// geografiske midtpunkt, som i store landkommuner kan ligge ude på marken. Byen er
// "Største by" fra databasen (redigeres i admin-panelet); mangler den, bruges
// BY_UDEN_STOERSTE_BY eller kommunenavnet. Koordinaterne slås op i Photon (OpenStreetMap)
// og skal ligge inden for kommunegrænsen på kortet; ellers bruges midtpunktet af
// kommunens største polygon. Skriver data/kommune-punkter.json.

const GEOJSON = path.join(process.cwd(), "public/data/kommuner.geojson");
const MAAL = path.join(process.cwd(), "data/kommune-punkter.json");
const PHOTON = "https://photon.komoot.io/api/";
const HEADERS = { "User-Agent": "Kommuna/0.1 (kommunescore; https://github.com/tobiasbrogner/kommunescore)" };

// Kommuner uden "Største by" i databasen, hvor byen ikke hedder det samme som kommunen.
const BY_UDEN_STOERSTE_BY: Record<string, string> = {
  "0169": "Taastrup",
  "0173": "Kongens Lyngby",
  "0253": "Greve Strand",
  "0350": "Hvalsø",
  "0710": "Hinnerup",
};

type Ring = [number, number][];

function iRing([x, y]: [number, number], ring: Ring) {
  let inde = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inde = !inde;
  }
  return inde;
}

function iKommune(punkt: [number, number], polygoner: Ring[][]) {
  return polygoner.some(([ydre, ...huller]) => iRing(punkt, ydre) && !huller.some((h) => iRing(punkt, h)));
}

/** Midtpunktet af ydergrænsen på kommunens største polygon (efter antal punkter). */
function midtpunkt(polygoner: Ring[][]): [number, number] {
  const ydre = polygoner.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
  const sum = ydre.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
  return [sum[0] / ydre.length, sum[1] / ydre.length];
}

/** Kandidater for et stednavn i Danmark som [lon, lat], byer og bydele først. */
async function slaaOp(navn: string): Promise<[number, number][]> {
  const url = `${PHOTON}?q=${encodeURIComponent(navn)}&limit=10&bbox=7.5,54.5,15.3,57.8`;
  const svar = await fetch(url, { headers: HEADERS });
  if (!svar.ok) throw new Error(`Photon: HTTP ${svar.status}`);
  const features = (await svar.json()).features as {
    properties: { osm_key: string; countrycode?: string };
    geometry: { coordinates: [number, number] };
  }[];
  return features
    .filter((f) => f.properties.countrycode === "DK")
    .sort((a, b) => Number(b.properties.osm_key === "place") - Number(a.properties.osm_key === "place"))
    .map((f) => f.geometry.coordinates);
}

async function main() {
  const geojson = JSON.parse(readFileSync(GEOJSON, "utf8")) as {
    features: { properties: { kode: string }; geometry: { type: string; coordinates: unknown } }[];
  };
  const polygonerPrKode = new Map(
    geojson.features.map((f) => [
      f.properties.kode,
      (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][],
    ]),
  );

  const alleKommuner = await db
    .select({ kode: kommuner.kode, navn: kommuner.navn, stoersteBy: kommuner.stoersteBy })
    .from(kommuner);

  const punkter: Record<string, { by: string; lat: number; lon: number }> = {};
  for (const kommune of alleKommuner.sort((a, b) => a.kode.localeCompare(b.kode))) {
    const polygoner = polygonerPrKode.get(kommune.kode);
    if (!polygoner) throw new Error(`${kommune.navn}: findes ikke i ${path.basename(GEOJSON)}`);

    const by = kommune.stoersteBy ?? BY_UDEN_STOERSTE_BY[kommune.kode] ?? kommune.navn;
    const fundet = (await slaaOp(by)).find((p) => iKommune(p, polygoner));
    const [lon, lat] = fundet ?? midtpunkt(polygoner);
    if (!fundet) console.warn(`${kommune.navn}: fandt ikke ${by} i kommunen, bruger midtpunktet.`);

    punkter[kommune.kode] = {
      by: fundet ? by : kommune.navn,
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
    };
    // Photon er en gratis tjeneste; skån den med en lille pause mellem opslagene.
    await new Promise((r) => setTimeout(r, 300));
  }

  writeFileSync(MAAL, JSON.stringify(punkter, null, 2) + "\n");
  console.log(`Skrev ${Object.keys(punkter).length} kommunepunkter til ${path.relative(process.cwd(), MAAL)}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
