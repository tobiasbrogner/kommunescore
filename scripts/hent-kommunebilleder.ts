import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Henter kommunefotos fra Wikimedia Commons til public/kommuner/<kode>.jpg ud fra
// data/kommune-billeder.json, hvor fil, fotograf og licens pr. kommune står (krediteringen
// vises på siden). Kun kommuner uden et billede hentes; med --alle hentes alle igen.
// Billederne beskæres til samme format som de øvrige: 2000×1125 (16:9).

const DATA = path.join(process.cwd(), "data/kommune-billeder.json");
const MAPPE = path.join(process.cwd(), "public/kommuner");
const BREDDE = 2000;
const HOEJDE = 1125;
// Commons beder om en beskrivende User-Agent ved automatiske kald.
const HEADERS = { "User-Agent": "Kommuna/0.1 (kommunescore; https://github.com/tobiasbrogner/kommunescore)" };

type KommuneBillede = { fil: string; fotograf: string; licens: string; licensUrl: string | null; side: string };

/** URL til en udgave af filen, der er lidt bredere end slutformatet, så den ikke skal
 * hentes i fuld opløsning. */
async function thumbUrl(fil: string): Promise<string> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url" +
    `&iiurlwidth=2400&titles=${encodeURIComponent(`File:${fil}`)}`;
  const svar = await fetch(url, { headers: HEADERS });
  if (!svar.ok) throw new Error(`${fil}: HTTP ${svar.status}`);
  const side = Object.values((await svar.json()).query.pages)[0] as {
    imageinfo?: { thumburl?: string; url: string }[];
  };
  const info = side.imageinfo?.[0];
  if (!info) throw new Error(`${fil}: findes ikke på Commons`);
  return info.thumburl ?? info.url;
}

async function main() {
  const alle = process.argv.includes("--alle");
  const billeder = JSON.parse(readFileSync(DATA, "utf8")) as Record<string, KommuneBillede>;

  let hentet = 0;
  for (const [kode, billede] of Object.entries(billeder)) {
    const maal = path.join(MAPPE, `${kode}.jpg`);
    if (!alle && existsSync(maal)) continue;

    const svar = await fetch(await thumbUrl(billede.fil), { headers: HEADERS });
    if (!svar.ok) throw new Error(`${billede.fil}: HTTP ${svar.status}`);
    await sharp(Buffer.from(await svar.arrayBuffer()))
      .rotate()
      .resize(BREDDE, HOEJDE, { fit: "cover", position: "centre" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(maal);
    hentet++;
    console.log(`${kode}: ${billede.fil}`);
  }

  console.log(`Hentede ${hentet} billeder.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
