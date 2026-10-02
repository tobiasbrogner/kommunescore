// MapLibre 6 henter sin worker som en separat ES-modul-fil ved siden af bundtet, og den
// fil følger ikke med, når Next bundler maplibre-gl. Scriptet kopierer workeren og det
// modul, den importerer, til public/maplibre/<version>/, hvor kortet peger på dem med
// setWorkerUrl. Versionen i stien gør, at browseren ikke bruger en gammel worker efter
// en opgradering. Kører automatisk før dev og build.
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pakkeSti = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pakkeSti, "utf8")) as { version: string };
const kilde = path.join(path.dirname(pakkeSti), "dist");
const rod = path.join(process.cwd(), "public", "maplibre");
const maal = path.join(rod, version);

rmSync(rod, { recursive: true, force: true });
mkdirSync(maal, { recursive: true });
for (const fil of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(path.join(kilde, fil), path.join(maal, fil));
}
console.log(`MapLibre-worker ${version} kopieret til public/maplibre/${version}`);
