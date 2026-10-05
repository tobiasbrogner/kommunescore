// MapLibre hentes ikke fra Next's bundle, men som ES-moduler fra public/maplibre/<version>/,
// hvor kortet og dets worker deler maplibre-gl-shared.mjs (se hentMapLibre i
// components/danmark-kort.tsx). Scriptet kopierer de tre filer derhen. Versionen i stien
// gør, at browseren ikke bruger gamle filer efter en opgradering. Kører automatisk før
// dev og build.
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
for (const fil of ["maplibre-gl.mjs", "maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(path.join(kilde, fil), path.join(maal, fil));
}
console.log(`MapLibre ${version} kopieret til public/maplibre/${version}`);
