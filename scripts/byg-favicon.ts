// Laver app/favicon.ico ud fra app/icon.svg (pnpm favicon:byg).
//
// Moderne browsere bruger icon.svg, men nogle tjenester (bl.a. Googles søgeresultater)
// leder efter /favicon.ico. Filen indeholder ikonet i 16, 32 og 48 px som PNG'er, hvilket
// ICO-formatet tillader. Kør scriptet igen, hvis icon.svg ændres.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const STOERRELSER = [16, 32, 48];

async function main() {
  const svg = readFileSync(path.join(process.cwd(), "app/icon.svg"));
  // SVG'en er 32 px; høj density, så den tegnes skarpt før den skaleres ned.
  const billeder = await Promise.all(
    STOERRELSER.map((px) => sharp(svg, { density: 576 }).resize(px, px).png().toBuffer()),
  );

  // ICO = 6 byte header + 16 byte pr. billede + selve billederne.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserveret
  header.writeUInt16LE(1, 2); // 1 = ikon
  header.writeUInt16LE(billeder.length, 4);

  let offset = 6 + 16 * billeder.length;
  const mappe = billeder.map((billede, i) => {
    const px = STOERRELSER[i];
    const post = Buffer.alloc(16);
    post.writeUInt8(px, 0); // bredde
    post.writeUInt8(px, 1); // højde
    post.writeUInt8(0, 2); // ingen farvepalet
    post.writeUInt8(0, 3); // reserveret
    post.writeUInt16LE(1, 4); // farveplaner
    post.writeUInt16LE(32, 6); // bit pr. pixel
    post.writeUInt32LE(billede.length, 8);
    post.writeUInt32LE(offset, 12);
    offset += billede.length;
    return post;
  });

  const ico = Buffer.concat([header, ...mappe, ...billeder]);
  writeFileSync(path.join(process.cwd(), "app/favicon.ico"), ico);
  console.log(`app/favicon.ico skrevet (${STOERRELSER.join(", ")} px, ${ico.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
