import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";
import { standardKortFarver } from "@/lib/kommuner/kort-farver";

// Forhåndsvisningen på /kort farvet med standardvægtene: det grå billede fra
// scripts/byg-kortgraenser.ts, hvor hver kommune tager sin farve fra CSS-variablen
// --k<kode>, med kommunernes farver lagt ind som et <style>. Så viser kortsiden et færdigt
// kort, før MapLibre er klar (se KortForhaandsvisning i components/danmark-kort.tsx).
const SKABELON = path.join(process.cwd(), "public/data/kort-forhaandsvisning.svg");

export async function GET(request: Request) {
  const [skabelon, { kategorier, kommuner }] = await Promise.all([
    readFile(SKABELON, "utf8"),
    getCachedKommuneScores(),
  ]);
  const farver = Object.entries(standardKortFarver(kategorier, kommuner))
    .map(([kode, farve]) => `--k${kode}:${farve}`)
    .join(";");
  const svg = skabelon.replace('<g id="kort">', `<style>#kort{${farver}}</style><g id="kort">`);
  const headers: Record<string, string> = {
    "Content-Type": "image/svg+xml",
    // Scorerne ændres sjældent; et par minutter gammelt billede er kun et øjebliksbillede.
    "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    Vary: "Accept-Encoding",
  };
  // Next.js komprimerer ikke svar fra route handlers, og billedet fylder 76 KB mod 26 KB
  // komprimeret; det er sidens første billede, så det skal være hurtigt.
  if (/\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")) {
    return new Response(gzipSync(svg), { headers: { ...headers, "Content-Encoding": "gzip" } });
  }
  return new Response(svg, { headers });
}
