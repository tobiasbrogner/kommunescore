// Laver den lette udgave af kommunegrænserne, som kortet henter i browseren
// (public/data/kommuner-kort.geojson). Den fulde fil (kommuner.geojson) beholdes til
// serveren og seed-scripterne, der regner areal og befolkningstæthed ud fra den.
//
// Grænserne forenkles som én fælles topologi, så to nabokommuner deler præcis den
// samme forenklede grænse og der ikke opstår huller eller overlap mellem dem. Derefter
// afrundes koordinaterne til 4 decimaler (ca. 6-11 m), hvilket er under en pixel ved
// de zoomniveauer, kortet normalt vises i.
//
// Kør: pnpm kort:graenser
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

const KILDE = path.join(process.cwd(), "public/data/kommuner.geojson");
const MAAL = path.join(process.cwd(), "public/data/kommuner-kort.geojson");
// Kvantil af punkternes Visvalingam-vægt, der bruges som tærskel: punkter med mindre
// vægt fjernes. 0,5 beholder knap halvdelen af punkterne, og 95 % af den fulde grænse
// ligger inden for ca. 22 m af den forenklede.
const FORENKLING = 0.5;
const DECIMALER = 4;

const kilde = JSON.parse(readFileSync(KILDE, "utf8")) as GeoJSON.FeatureCollection;
type KommuneTopologi = Topology<{ kommuner: GeometryCollection<Record<string, unknown>> }>;
const topo = presimplify(topology({ kommuner: kilde }) as unknown as KommuneTopologi);
const forenklet = simplify(topo, quantile(topo, FORENKLING)) as KommuneTopologi;
const resultat = feature(forenklet, forenklet.objects.kommuner) as GeoJSON.FeatureCollection;
resultat.features.forEach((f, i) => {
  f.properties = kilde.features[i].properties;
});

const tekst = JSON.stringify(resultat, (_noegle, vaerdi) =>
  typeof vaerdi === "number" && !Number.isInteger(vaerdi) ? +vaerdi.toFixed(DECIMALER) : vaerdi,
);
writeFileSync(MAAL, tekst);

const kb = (b: number) => `${Math.round(b / 1024)} KB`;
const kildeTekst = readFileSync(KILDE);
console.log(
  `kommuner-kort.geojson: ${kb(tekst.length)} (gzip ${kb(gzipSync(tekst).length)}) ` +
    `mod ${kb(kildeTekst.length)} (gzip ${kb(gzipSync(kildeTekst).length)}) for den fulde fil`,
);
