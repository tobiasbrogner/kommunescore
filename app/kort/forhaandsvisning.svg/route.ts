import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";
import { KORT_TEMA_FARVER, standardKortFarver } from "@/lib/kommuner/kort-farver";

// Forhåndsvisningen på /kort farvet med standardvægtene: det grå billede fra
// scripts/byg-kortgraenser.ts, hvor hver kommune tager sin farve fra CSS-variablen
// --k<kode>, med kommunernes farver lagt ind som et <style>. Så viser kortsiden et færdigt
// kort, før MapLibre er klar (se KortForhaandsvisning i components/danmark-kort.tsx).
// ?tema=moerk giver billedet i mørkt tema, og ?farver=nej det grå billede uden scorer.
const SKABELON = path.join(process.cwd(), "public/data/kort-forhaandsvisning.svg");

export async function GET(request: Request) {
  const parametre = new URL(request.url).searchParams;
  const scorer = parametre.get("farver") === "nej" ? null : getCachedKommuneScores();
  let svg = await readFile(SKABELON, "utf8");
  if (parametre.get("tema") === "moerk") {
    // Skabelonen er tegnet i det lyse temas farver; de byttes til det mørke temas.
    const lys = KORT_TEMA_FARVER.lys;
    const moerk = KORT_TEMA_FARVER.moerk;
    svg = svg
      .replace(`fill="${lys.land}"`, `fill="${moerk.land}"`)
      .replace('stroke="#fff"', `stroke="${moerk.linje}"`)
      .replaceAll(`,${lys.graaKommune})`, `,${moerk.graaKommune})`);
  }
  if (scorer) {
    const { kategorier, kommuner } = await scorer;
    const farver = Object.entries(standardKortFarver(kategorier, kommuner))
      .map(([kode, farve]) => `--k${kode}:${farve}`)
      .join(";");
    svg = svg.replace('<g id="kort">', `<style>#kort{${farver}}</style><g id="kort">`);
  }
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
