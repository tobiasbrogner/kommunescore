// Laver den forenklede kystlinje af Danmark, som forsiden viser som billede
// (lib/danmarkskort.ts). Kommunegrænserne fra public/data/kommuner.geojson smeltes
// sammen til landmasser, forenkles kraftigt, og kun de store landsdele beholdes
// (Jylland med Vendsyssel-Thy, Fyn, Sjælland, Lolland og Falster). Kun ydre omrids, ingen søer.
// Bornholm vises som på mange danmarkskort i en lille ramme i det tomme hjørne mod nordøst,
// i samme målestok som resten.
//
// Projektionen er en simpel lige-afstands-projektion, hvor længdegraderne skaleres med
// cos(56°), så landet har de rigtige proportioner. Den samme projektion skrives med i
// filen, så husene på forsiden kan placeres ud fra kommunernes længde- og breddegrad.
//
// Kør: pnpm kort:forside
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { merge } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

const KILDE = path.join(process.cwd(), "public/data/kommuner.geojson");
const MAAL = path.join(process.cwd(), "lib/danmarkskort.ts");

// Andel af punkterne (efter Visvalingam-vægt), der fjernes. Kysten skal kun se rigtig ud
// i et lille billede, så næsten alt kan væk.
const FORENKLING = 0.985;
// Landmasser under denne andel af den største udelades (Mors, Als, Møn, Langeland osv.).
// Fyn er ca. 10 % af Jylland (inkl. Vendsyssel-Thy), Lolland ca. 4 % og Falster ca. 1,7 %.
const MINDSTE_ANDEL = 0.016;
// Bornholm er lige så stor som Falster, men ligger så langt mod øst, at billedet ville blive
// meget bredere. Landmasser helt øst for denne længdegrad (Bornholm og Ertholmene) tegnes
// derfor i en ramme i hjørnet i stedet; kun selve Bornholm, ikke de små øer.
const OESTLIGSTE_LAENGDE = 14;
// Rammen om Bornholm: luft inden for rammen og dens placering i billedet (højre kant og
// top i andele af billedets bredde og højde), i det tomme hav nordøst for Sjælland.
const RAMME_LUFT = 16;
const RAMME_HOEJRE = 0.86;
const RAMME_TOP = 0.2;
// Efter sammensmeltningen forenkles kysten igen (Douglas-Peucker), så ingen punkter
// afviger mere end dette fra den rigtige kyst, målt i billedets enheder (bredde 1000).
const TOLERANCE = 1.6;
const BREDDE = 1000;
// Luft rundt om landet, så husene ved kysten (fx København) ikke skæres af.
const MARGEN = 40;
const COS_LAT = Math.cos((56 * Math.PI) / 180);

type Punkt = [number, number];
const projekter = ([lon, lat]: number[]): Punkt => [lon * COS_LAT, -lat];

function areal(ring: Punkt[]) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

// Douglas-Peucker på en lukket ring (iterativ, så lange kyster ikke sprænger stakken).
// Ringens første og sidste punkt er det samme, så den deles ved punktet længst fra
// starten, og de to halvdele forenkles hver for sig.
function forenkleRing(ring: Punkt[], tolerance: number): Punkt[] {
  const [sx, sy] = ring[0];
  let fjernest = 1;
  for (let i = 1; i < ring.length; i++) {
    if (Math.hypot(ring[i][0] - sx, ring[i][1] - sy) > Math.hypot(ring[fjernest][0] - sx, ring[fjernest][1] - sy)) {
      fjernest = i;
    }
  }
  const behold = new Uint8Array(ring.length);
  behold[0] = behold[fjernest] = behold[ring.length - 1] = 1;
  const stak: [number, number][] = [
    [0, fjernest],
    [fjernest, ring.length - 1],
  ];
  while (stak.length > 0) {
    const [fra, til] = stak.pop()!;
    const [ax, ay] = ring[fra];
    const [bx, by] = ring[til];
    const dx = bx - ax;
    const dy = by - ay;
    const laengde = Math.hypot(dx, dy) || 1;
    let stoersteAfstand = 0;
    let indeks = -1;
    for (let i = fra + 1; i < til; i++) {
      const afstand = Math.abs(dy * ring[i][0] - dx * ring[i][1] + bx * ay - by * ax) / laengde;
      if (afstand > stoersteAfstand) {
        stoersteAfstand = afstand;
        indeks = i;
      }
    }
    if (indeks >= 0 && stoersteAfstand > tolerance) {
      behold[indeks] = 1;
      stak.push([fra, indeks], [indeks, til]);
    }
  }
  return ring.filter((_, i) => behold[i]);
}

const kilde = JSON.parse(readFileSync(KILDE, "utf8")) as GeoJSON.FeatureCollection;
type KommuneTopologi = Topology<{ kommuner: GeometryCollection<Record<string, unknown>> }>;
const topo = presimplify(topology({ kommuner: kilde }) as unknown as KommuneTopologi);
const forenklet = simplify(topo, quantile(topo, FORENKLING)) as KommuneTopologi;
// merge smelter alle kommuner sammen langs deres fælles grænser til landmasser.
const land = merge(forenklet, forenklet.objects.kommuner.geometries as never) as GeoJSON.MultiPolygon;

// Kun ydre ringe (første ring i hver polygon), projiceret. Bornholm holdes for sig.
const erOest = (polygon: number[][][]) => Math.min(...polygon[0].map(([lon]) => lon)) >= OESTLIGSTE_LAENGDE;
const ringe = land.coordinates.filter((p) => !erOest(p)).map((polygon) => polygon[0].map(projekter));
const oestRinge = land.coordinates.filter(erOest).map((polygon) => polygon[0].map(projekter));
const bornholm = oestRinge.reduce((a, b) => (areal(b) > areal(a) ? b : a));
const stoerst = Math.max(...ringe.map(areal));
const beholdt = ringe.filter((r) => areal(r) >= stoerst * MINDSTE_ANDEL);

const alle = beholdt.flat();
const minX = Math.min(...alle.map((p) => p[0]));
const maxX = Math.max(...alle.map((p) => p[0]));
const minY = Math.min(...alle.map((p) => p[1]));
const maxY = Math.max(...alle.map((p) => p[1]));
const skala = (BREDDE - 2 * MARGEN) / (maxX - minX);
const hoejde = Math.round((maxY - minY) * skala + 2 * MARGEN);

const iBillede = ([x, y]: Punkt): Punkt => [(x - minX) * skala + MARGEN, (y - minY) * skala + MARGEN];
const ringeIBillede = beholdt.map((ring) => forenkleRing(ring.map(iBillede), TOLERANCE));
const tilSti = (ring: Punkt[]) => `M${ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
const sti = ringeIBillede.map(tilSti).join("");

// Bornholm i samme målestok, flyttet op i hjørnet: rammens højre kant og top ligger fast,
// og øen centreres i den.
const bornholmIBillede = forenkleRing(bornholm.map(iBillede), TOLERANCE);
const bxs = bornholmIBillede.map((p) => p[0]);
const bys = bornholmIBillede.map((p) => p[1]);
const rammeB = Math.max(...bxs) - Math.min(...bxs) + 2 * RAMME_LUFT;
const rammeH = Math.max(...bys) - Math.min(...bys) + 2 * RAMME_LUFT;
const rammeX = BREDDE * RAMME_HOEJRE - rammeB;
const rammeY = hoejde * RAMME_TOP;
const flytX = rammeX + RAMME_LUFT - Math.min(...bxs);
const flytY = rammeY + RAMME_LUFT - Math.min(...bys);
const bornholmSti = tilSti(bornholmIBillede.map(([x, y]) => [x + flytX, y + flytY]));

const indhold = `// Genereret af scripts/byg-danmarkskort.ts (pnpm kort:forside) – ret ikke i hånden.
// Forenklet kystlinje af Jylland, Fyn, Sjælland, Lolland og Falster (og Bornholm i en ramme)
// til billedet på forsiden.

export const DANMARK_VIEWBOX = "0 0 ${BREDDE} ${hoejde}";
export const DANMARK_BREDDE = ${BREDDE};
export const DANMARK_HOEJDE = ${hoejde};

export const DANMARK_STI =
  "${sti}";

/** Bornholm, flyttet op i en ramme i hjørnet (samme målestok som resten). */
export const BORNHOLM_STI = "${bornholmSti}";
export const BORNHOLM_RAMME = { x: ${rammeX.toFixed(1)}, y: ${rammeY.toFixed(1)}, bredde: ${rammeB.toFixed(1)}, hoejde: ${rammeH.toFixed(1)} };

/** Længde- og breddegrad til et punkt i billedets koordinater (samme projektion som stien).
 * Punkter på Bornholm flyttes med op i rammen. */
export function projekterTilDanmarkskort(lon: number, lat: number): [number, number] {
  const x = (lon * ${COS_LAT} - ${minX}) * ${skala} + ${MARGEN};
  const y = (-lat - ${minY}) * ${skala} + ${MARGEN};
  return lon >= ${OESTLIGSTE_LAENGDE} ? [x + ${flytX.toFixed(2)}, y + ${flytY.toFixed(2)}] : [x, y];
}
`;

writeFileSync(MAAL, indhold);
console.log(
  `Danmarkskort: ${beholdt.length} landmasser (af ${ringe.length}), ${ringeIBillede.flat().length} punkter, ` +
    `${(sti.length / 1024).toFixed(1)} KB sti, ${BREDDE}×${hoejde}.`,
);
