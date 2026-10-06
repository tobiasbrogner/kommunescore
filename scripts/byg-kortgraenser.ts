// Laver den lette udgave af kommunegrænserne, som kortet henter i browseren
// (public/data/kommuner-kort.geojson). Den fulde fil (kommuner.geojson) beholdes til
// serveren og seed-scripterne, der regner areal og befolkningstæthed ud fra den.
//
// Grænserne forenkles som én fælles topologi, så to nabokommuner deler præcis den
// samme forenklede grænse og der ikke opstår huller eller overlap mellem dem. Derefter
// afrundes koordinaterne til 4 decimaler (ca. 6-11 m), hvilket er under en pixel ved
// de zoomniveauer, kortet normalt vises i.
//
// Samtidig gemmes navnenes placering på kortet (public/data/kommune-navne.geojson), så
// browseren ikke skal regne dem ud, før kortet kan vises, og en grov forhåndsvisning af
// kortet (public/data/kort-forhaandsvisning.svg), som vises, mens kortet indlæses.
//
// Kør: pnpm kort:graenser
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { kommuneNavnePunkter } from "@/lib/kommuner/kommune-dele";
import { DANMARK_BOUNDS, mercator } from "@/lib/kommuner/kort-udsnit";

const KILDE = path.join(process.cwd(), "public/data/kommuner.geojson");
const MAAL = path.join(process.cwd(), "public/data/kommuner-kort.geojson");
const NAVNE_MAAL = path.join(process.cwd(), "public/data/kommune-navne.geojson");
const NABOLANDE = path.join(process.cwd(), "public/data/nabolande.geojson");
const FORHAANDSVISNING_MAAL = path.join(process.cwd(), "public/data/kort-forhaandsvisning.svg");
const FORHAANDSVISNING_TS = path.join(process.cwd(), "lib/kommuner/kort-forhaandsvisning.ts");
// Forhåndsvisningen skal kun ligne kortet i et øjeblik, så den beholder kun 3 % af
// kommunernes punkter. Nabolandene har langt færre punkter fra start og beholder flere.
const FORHAANDSVISNING_FORENKLING = 0.03;
const FORHAANDSVISNING_FORENKLING_NABOLANDE = 0.3;
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

const afrund = (_noegle: string, vaerdi: unknown) =>
  typeof vaerdi === "number" && !Number.isInteger(vaerdi) ? +vaerdi.toFixed(DECIMALER) : vaerdi;
const tekst = JSON.stringify(resultat, afrund);
writeFileSync(MAAL, tekst);
// Navnene regnes ud fra den forenklede (og afrundede) udgave, som kortet viser.
const navne = JSON.stringify(kommuneNavnePunkter(JSON.parse(tekst)), afrund);
writeFileSync(NAVNE_MAAL, navne);

const kb = (b: number) => `${Math.round(b / 1024)} KB`;
const kildeTekst = readFileSync(KILDE);
console.log(
  `kommuner-kort.geojson: ${kb(tekst.length)} (gzip ${kb(gzipSync(tekst).length)}) ` +
    `mod ${kb(kildeTekst.length)} (gzip ${kb(gzipSync(kildeTekst).length)}) for den fulde fil`,
);
console.log(`kommune-navne.geojson: ${kb(navne.length)} (gzip ${kb(gzipSync(navne).length)})`);

// Forhåndsvisningen: kommuner og nabolande i Web Mercator som MapLibre. Danmarks udsnit
// (DANMARK_BOUNDS) er 1000 enheder bredt; billedet dækker hele nabolandenes område, så
// det også fylder kortet, når udsnittet ikke har samme form som kortet.
const forenkl = (geojson: GeoJSON.FeatureCollection, andel: number) => {
  type Topo = Topology<{ lag: GeometryCollection<Record<string, unknown>> }>;
  const t = presimplify(topology({ lag: geojson }) as unknown as Topo);
  const f = simplify(t, quantile(t, andel)) as Topo;
  return feature(f, f.objects.lag) as GeoJSON.FeatureCollection;
};
const nabolande = JSON.parse(readFileSync(NABOLANDE, "utf8")) as GeoJSON.FeatureCollection;
const [bMin, bMax] = [mercator(...DANMARK_BOUNDS[0]), mercator(...DANMARK_BOUNDS[1])];
const skala = 1000 / (bMax[0] - bMin[0]);
const udsnit = { x: 0, y: 0, bredde: 1000, hoejde: (bMin[1] - bMax[1]) * skala };
const punkt = ([lon, lat]: GeoJSON.Position) => {
  const [x, y] = mercator(lon, lat);
  return [(x - bMin[0]) * skala, (y - bMax[1]) * skala];
};
const sti = (geojson: GeoJSON.FeatureCollection) =>
  geojson.features
    .flatMap((f) => {
      const g = f.geometry;
      return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    })
    .flat()
    .map((ring) => ring.map(punkt))
    // Små øer kan ikke ses i forhåndsvisningen og ville kun gøre filen større.
    .filter((ring) => polygonAreal(ring) > 2)
    .map((ring) => "M" + ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z")
    .join("");
function polygonAreal(ring: number[][]) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a) / 2;
}
const hele = [punkt([5.16, 59.5]), punkt([18, 52.5])];
const vb = { x: hele[0][0], y: hele[0][1], bredde: hele[1][0] - hele[0][0], hoejde: hele[1][1] - hele[0][1] };
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.bredde.toFixed(1)} ${vb.hoejde.toFixed(1)}">` +
  `<path fill="#e8e5d9" d="${sti(forenkl(nabolande, FORHAANDSVISNING_FORENKLING_NABOLANDE))}"/>` +
  `<path fill="#dcd8c9" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linejoin="round" d="${sti(forenkl(kilde, FORHAANDSVISNING_FORENKLING))}"/>` +
  `</svg>`;
writeFileSync(FORHAANDSVISNING_MAAL, svg);
// Billedets placering i forhold til Danmarks udsnit, i procent af udsnittet.
const pct = (v: number) => +(v * 100).toFixed(3);
writeFileSync(
  FORHAANDSVISNING_TS,
  `// Genereret af scripts/byg-kortgraenser.ts (pnpm kort:graenser) – ret ikke i hånden.
// Placeringen af public/data/kort-forhaandsvisning.svg i forhold til Danmarks udsnit på /kort.
export const FORHAANDSVISNING = {
  /** Udsnittets bredde delt med højden. */
  forhold: ${+(udsnit.bredde / udsnit.hoejde).toFixed(5)},
  venstre: ${pct((vb.x - udsnit.x) / udsnit.bredde)},
  top: ${pct((vb.y - udsnit.y) / udsnit.hoejde)},
  bredde: ${pct(vb.bredde / udsnit.bredde)},
  hoejde: ${pct(vb.hoejde / udsnit.hoejde)},
};
`,
);
console.log(`kort-forhaandsvisning.svg: ${kb(svg.length)} (gzip ${kb(gzipSync(svg).length)})`);
