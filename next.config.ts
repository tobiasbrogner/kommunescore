import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Kortet henter MapLibre fra public/maplibre/<version>/ (se scripts/kopier-maplibre-worker.ts).
const maplibreVersion = (
  JSON.parse(
    readFileSync(path.join(process.cwd(), "node_modules/maplibre-gl/package.json"), "utf8"),
  ) as { version: string }
).version;

// Sikkerheds-headere på alle sider og filer. De ændrer ikke, hvordan siden ser ud, men
// beder browseren om at passe på:
const SIKKERHEDS_HEADERE = [
  // Siden må ikke vises inde i en anden hjemmeside, så ingen kan lægge den skjult over
  // deres egen side og narre folk til at klikke på noget.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // Browseren må ikke gætte på en fils type, men skal bruge den, serveren angiver.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Andre sider ser kun domænet, man kom fra, ikke hele adressen.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Siden bruger hverken kamera, mikrofon, placering eller betaling, så de er slået fra.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Browseren skal altid bruge https i et år, når den først har set siden over https.
  // Ignoreres over http, fx lokalt.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  env: { MAPLIBRE_VERSION: maplibreVersion },
  // Fortæl ikke alle, at siden kører Next.js (X-Powered-By).
  poweredByHeader: false,
  // PDF-ruten pakker Chrome ud fra @sparticuz/chromium's bin-mappe, som Next.js ikke selv
  // kan se, at den bruger. Uden dette mangler Chrome på Vercel.
  outputFileTracingIncludes: {
    "/api/kommune/*/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  images: {
    // AVIF er ca. en tredjedel mindre end WebP; browsere uden AVIF får WebP.
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SIKKERHEDS_HEADERE },
      // Kommunefotoene skifter sjældent. Uden dette sender Vercel max-age=0, også for de
      // optimerede udgaver (/_next/image arver fotoets max-age), så browseren spørger
      // serveren om hvert foto igen ved hvert besøg. Nu genbruges de i en uge og
      // tjekkes i baggrunden i en måned derefter.
      {
        source: "/kommuner/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" },
        ],
      },
      // Kortenes små fotos har fotoets version i navnet (se scripts/byg-kortbilleder.ts), så
      // et nyt foto får en ny adresse, og de gamle filer må gemmes i et år. Står efter
      // reglen ovenfor, så den vinder.
      {
        source: "/kommuner/kort/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  experimental: {
    // Fejler en side under buildet (fx fordi databasen kortvarigt er løbet tør for
    // forbindelser, se lib/db/index.ts), prøves den én gang til, før buildet stopper.
    staticGenerationRetryCount: 1,
    // Højst 4 processer laver sider samtidig, så buildet (4 × 2 forbindelser, se
    // lib/db/index.ts) ikke bruger alle databasens 17 forbindelser. Vercels byggemaskine
    // har flere kerner end det, og så fik sitemap'et "too many clients".
    cpus: 4,
  },
};

export default nextConfig;
