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
// kortet (public/data/kort-forhaandsvisning.svg), som vises, mens kortet indlæses. Hver
// kommune er sin egen flade med farven fra CSS-variablen --k<kode> (fx --k0101), så
// serveren kan farve billedet med standardvægtene (app/kort/forhaandsvisning.svg).
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
const graense = quantile(topo, FORENKLING);

const afrund = (_noegle: string, vaerdi: unknown) =>
  typeof vaerdi === "number" && !Number.isInteger(vaerdi) ? +vaerdi.toFixed(DECIMALER) : vaerdi;

// Forenklingen (og afrundingen) kan få en grænse til at krydse sig selv, typisk i smalle
// havne og fjorde. MapLibre deler så fladen forkert op i trekanter, og dele af kommunen
// tegnes to gange og ser lysere ud (fx ved Lemvig havn). Punkterne omkring hvert kryds
// beholdes derfor uforenklede, og der forenkles igen, til der ikke er flere kryds, end
// den fulde fil selv har.
const kildeKryds = new Set(selvkryds(kilde).map((k) => k.noegle));
let tekst = "";
for (let runde = 1; ; runde++) {
  const forenklet = simplify(topo, graense) as KommuneTopologi;
  const resultat = feature(forenklet, forenklet.objects.kommuner) as GeoJSON.FeatureCollection;
  resultat.features.forEach((f, i) => {
    f.properties = kilde.features[i].properties;
  });
  tekst = JSON.stringify(resultat, afrund);
  const kryds = selvkryds(JSON.parse(tekst)).filter((k) => !kildeKryds.has(k.noegle));
  if (kryds.length === 0) break;
  if (runde === 10) throw new Error(`${kryds.length} selvkryds efter forenkling: ${kryds.map((k) => k.noegle)}`);
  // Lidt luft om krydset, så også de punkter, der blev fjernet lige ved siden af, kommer med.
  const luft = 0.002;
  for (const arc of topo.arcs as number[][][]) {
    for (const p of arc) {
      if (kryds.some(({ boks: [x0, y0, x1, y1] }) => p[0] >= x0 - luft && p[0] <= x1 + luft && p[1] >= y0 - luft && p[1] <= y1 + luft)) {
        p[2] = Infinity;
      }
    }
  }
}

/** Steder, hvor en kommunes grænse krydser sig selv (også mellem en ø og dens hul). */
function selvkryds(fc: GeoJSON.FeatureCollection) {
  const krydsPunkt = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const fund: { noegle: string; boks: number[] }[] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    const polygoner = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const ringe of polygoner) {
      const stykker = ringe.flatMap((ring, r) =>
        ring.slice(0, -1).map((a, i) => {
          const b = ring[i + 1];
          return { r, i, a, b, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };
        }),
      );
      stykker.sort((s, t) => s.x0 - t.x0);
      for (let i = 0; i < stykker.length; i++) {
        const s = stykker[i];
        for (let j = i + 1; j < stykker.length && stykker[j].x0 <= s.x1; j++) {
          const t = stykker[j];
          if (t.y1 < s.y0 || t.y0 > s.y1) continue;
          // Naboer på samme ring deler et punkt og tæller ikke som kryds.
          const n = ringe[s.r].length - 1;
          if (s.r === t.r && (Math.abs(s.i - t.i) === 1 || Math.abs(s.i - t.i) === n - 1)) continue;
          const d1 = krydsPunkt(t.a, t.b, s.a);
          const d2 = krydsPunkt(t.a, t.b, s.b);
          const d3 = krydsPunkt(s.a, s.b, t.a);
          const d4 = krydsPunkt(s.a, s.b, t.b);
          if (d1 * d2 < 0 && d3 * d4 < 0) {
            fund.push({
              noegle: `${f.properties?.navn}@${s.a[0].toFixed(2)},${s.a[1].toFixed(2)}`,
              boks: [Math.min(s.x0, t.x0), Math.min(s.y0, t.y0), Math.max(s.x1, t.x1), Math.max(s.y1, t.y1)],
            });
          }
        }
      }
    }
  }
  return fund;
}
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
const sti = (geojson: GeoJSON.FeatureCollection | GeoJSON.Feature) =>
  ("features" in geojson ? geojson.features : [geojson])
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
const viewBox = [vb.x, vb.y, vb.bredde, vb.hoejde].map((v) => v.toFixed(1)).join(" ");
// Kommunerne er grå (#dcd8c9), indtil serveren lægger et <style> med deres farver ind
// foran <g id="kort">.
const kommuneStier = forenkl(kilde, FORHAANDSVISNING_FORENKLING)
  .features.map((f, i) => ({ kode: String(kilde.features[i].properties?.kode), d: sti(f) }))
  .filter(({ d }) => d.length > 0)
  .map(({ kode, d }) => `<path style="fill:var(--k${kode},#dcd8c9)" d="${d}"/>`)
  .join("");
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><g id="kort">` +
  `<path fill="#e8e5d9" d="${sti(forenkl(nabolande, FORHAANDSVISNING_FORENKLING_NABOLANDE))}"/>` +
  `<g stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linejoin="round">${kommuneStier}</g>` +
  `</g></svg>`;
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
