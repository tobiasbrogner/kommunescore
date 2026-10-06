import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Kortet henter MapLibre fra public/maplibre/<version>/ (se scripts/kopier-maplibre-worker.ts).
const maplibreVersion = (
  JSON.parse(
    readFileSync(path.join(process.cwd(), "node_modules/maplibre-gl/package.json"), "utf8"),
  ) as { version: string }
).version;

const nextConfig: NextConfig = {
  env: { MAPLIBRE_VERSION: maplibreVersion },
  experimental: {
    // Fejler en side under buildet (fx fordi databasen kortvarigt er løbet tør for
    // forbindelser, se lib/db/index.ts), prøves den én gang til, før buildet stopper.
    staticGenerationRetryCount: 1,
  },
};

export default nextConfig;
