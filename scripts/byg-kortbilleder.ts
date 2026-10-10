// Laver de små fotos til kortene på /kort ud fra public/kommuner/<kode>.jpg (pnpm kortbilleder:byg).
//
// Kortene viser kun en smal stribe af fotoet. Før gik de gennem Next.js' billedoptimering,
// som laver hver udgave første gang, nogen beder om den (ca. 1 s), og sender hele fotoet
// skaleret ned. Her beskæres fotoet på forhånd til et banner og gemmes som AVIF og WebP i
// nogle få bredder, så Vercel bare sender en færdig fil.
//
// Filerne hedder <kode>.<version>.<bredde>.<format>, hvor versionen kommer fra JPG'ens
// indhold. Et nyt foto får derfor et nyt navn, så browseren må gemme filerne i et år (se
// next.config.ts). Gamle udgaver slettes. Mangler et foto sine små udgaver, bruger kortet
// stadig den store JPG.
//
// Scriptet kører også i `pnpm build` (og dermed på Vercel). Fotos, der allerede har alle
// deres udgaver, springes over, så det tager under et sekund, når alt er committet. Kør
// det lokalt og commit filerne, når et foto tilføjes eller skiftes ud, så Vercel ikke skal
// lave dem ved hvert build. Ændres bredder, forhold eller kvalitet, så kør
// `pnpm kortbilleder:byg --alle` for at lave alle filerne forfra.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { KORTBILLEDE_BREDDER, KORTBILLEDE_FORHOLD } from "../lib/kommuner/kortbilleder";

const KILDE = path.join(process.cwd(), "public/kommuner");
const MAAL = path.join(KILDE, "kort");
const FORMATER = ["avif", "webp"] as const;

async function main() {
  mkdirSync(MAAL, { recursive: true });
  const fotos = readdirSync(KILDE).filter((fil) => /^\d{4}\.jpg$/.test(fil));
  const alle = process.argv.includes("--alle");
  const nyeFiler = new Set<string>();
  let lavet = 0;

  for (const foto of fotos) {
    const kode = foto.slice(0, 4);
    const indhold = readFileSync(path.join(KILDE, foto));
    const version = createHash("sha256").update(indhold).digest("hex").slice(0, 8);
    const filer = KORTBILLEDE_BREDDER.flatMap((b) => FORMATER.map((f) => `${kode}.${version}.${b}.${f}`));
    for (const fil of filer) nyeFiler.add(fil);
    if (!alle && filer.every((fil) => existsSync(path.join(MAAL, fil)))) continue;

    lavet++;
    for (const bredde of KORTBILLEDE_BREDDER) {
      // Midten af fotoet, ligesom object-cover på kortet.
      const beskaaret = sharp(indhold)
        .rotate()
        .resize(bredde, Math.round(bredde / KORTBILLEDE_FORHOLD), { fit: "cover", position: "centre" });
      await Promise.all([
        beskaaret.clone().avif({ quality: 45, effort: 6 }).toFile(path.join(MAAL, `${kode}.${version}.${bredde}.avif`)),
        beskaaret.clone().webp({ quality: 68 }).toFile(path.join(MAAL, `${kode}.${version}.${bredde}.webp`)),
      ]);
    }
  }

  // Udgaver af fotos, der er skiftet ud eller fjernet.
  let slettet = 0;
  for (const fil of readdirSync(MAAL)) {
    if (!nyeFiler.has(fil)) {
      rmSync(path.join(MAAL, fil));
      slettet++;
    }
  }

  console.log(
    `Kortbilleder: ${lavet} af ${fotos.length} fotos lavet, ${fotos.length - lavet} var klar` +
      (slettet ? `, ${slettet} gamle filer slettet` : ""),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
