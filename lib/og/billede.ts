import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ImageResponse } from "next/og";
import sharp from "sharp";

// Fælles for delebillederne (fx på Facebook og i Messenger): kommunerapporternes
// (app/kommune/[slug]/opengraph-image.tsx) og kommunetestens (app/kommunetest/billede).

export const DELEBILLEDE_STOERRELSE = { width: 1200, height: 630 };
export const OG_FARVER = {
  baggrund: "#f9f8f4",
  tekst: "#1c1b22",
  daempet: "#6b6878",
  accent: "#5b21e6",
};

// Sidens skrift, Geist, i almindelig og halvfed vægt (overskrifterne på siden er halvfede).
// ImageResponse kan ikke læse woff2, så filerne ligger som ttf i lib/og.
export async function geist() {
  const mappe = path.join(process.cwd(), "lib/og");
  const [normal, halvfed] = await Promise.all([
    readFile(path.join(mappe, "Geist-Regular.ttf")),
    readFile(path.join(mappe, "Geist-SemiBold.ttf")),
  ]);
  return [
    { name: "Geist", data: normal, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: halvfed, weight: 600 as const, style: "normal" as const },
  ];
}

export async function dataUrl(fil: string, type: string) {
  return `data:${type};base64,${(await readFile(fil)).toString("base64")}`;
}

// ImageResponse laver altid PNG, som med et foto fylder ca. 800 KB. Som JPEG fylder billedet
// en brøkdel; WhatsApp viser fx ikke delebilleder over ca. 300 KB.
export async function somJpeg(billede: ImageResponse, headersEkstra: Record<string, string> = {}) {
  const png = Buffer.from(await billede.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const headers = new Headers(billede.headers);
  headers.set("content-type", "image/jpeg");
  headers.delete("content-length");
  for (const [navn, vaerdi] of Object.entries(headersEkstra)) headers.set(navn, vaerdi);
  return new Response(new Uint8Array(jpeg), { status: billede.status, headers });
}
