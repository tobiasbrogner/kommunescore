import "server-only";

import { readdirSync } from "node:fs";
import path from "node:path";
import billedKreditter from "@/data/kommune-billeder.json";

// Fotograf og licens for kommunefotos fra Wikimedia Commons (se scripts/hent-kommunebilleder.ts).
// Licenserne kræver kreditering, så den vises på kommunerapporten og på /kilder. Fotos
// uden en post her har ingen kendt kilde endnu.
export type BilledKredit = {
  fil: string;
  fotograf: string;
  licens: string;
  licensUrl: string | null;
  side: string;
};

export function billedKredit(kode: string): BilledKredit | null {
  return (billedKreditter as Record<string, BilledKredit>)[kode] ?? null;
}

export function alleBilledKreditter(): [kode: string, kredit: BilledKredit][] {
  return Object.entries(billedKreditter as Record<string, BilledKredit>);
}

// Kommunekoder, der har et foto i public/kommuner/ (fx "0101.jpg"). Læses fra mappen, så nye
// billeder automatisk tages i brug, og siden ikke beder om billeder, der ikke findes.
export function kommunerMedBillede(): string[] {
  return readdirSync(path.join(process.cwd(), "public/kommuner"))
    .filter((fil) => /^\d{4}\.jpg$/.test(fil))
    .map((fil) => fil.slice(0, 4));
}

// Versionen af hvert fotos små udgaver til kortene på /kort (se scripts/byg-kortbilleder.ts),
// fx { "0101": "b2e31035" }. Fotos uden små udgaver er ikke med; de vises fra den store JPG.
export function kortbilledVersioner(): Record<string, string> {
  const versioner: Record<string, string> = {};
  for (const fil of readdirSync(path.join(process.cwd(), "public/kommuner/kort"))) {
    const match = /^(\d{4})\.([0-9a-f]{8})\.\d+\.avif$/.exec(fil);
    if (match) versioner[match[1]] = match[2];
  }
  return versioner;
}
