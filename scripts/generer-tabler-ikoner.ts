import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const KILDE_DIR = path.join(
  process.cwd(),
  "node_modules/.pnpm/@tabler+icons@3.47.0/node_modules/@tabler/icons/icons/outline",
);
const MAAL_FIL = path.join(process.cwd(), "public/tabler-ikoner.json");

async function main() {
  const filer = (await readdir(KILDE_DIR)).filter((f) => f.endsWith(".svg"));
  if (filer.length === 0) {
    throw new Error(`Fandt ingen SVG-filer i ${KILDE_DIR}`);
  }

  const ikoner: Record<string, string> = {};

  for (const fil of filer) {
    const navn = fil.replace(/\.svg$/, "");
    const raa = await readFile(path.join(KILDE_DIR, fil), "utf-8");
    const match = raa.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
    if (!match) continue;
    ikoner[navn] = match[1].trim().replace(/\s+/g, " ");
  }

  await writeFile(MAAL_FIL, JSON.stringify(ikoner), "utf-8");
  console.log(`Skrev ${Object.keys(ikoner).length} ikoner til ${MAAL_FIL}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
