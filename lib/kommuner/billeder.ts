import "server-only";

import { readdirSync } from "node:fs";
import path from "node:path";

// Kommunekoder, der har et foto i public/kommuner/ (fx "0101.jpg"). Læses fra mappen, så nye
// billeder automatisk tages i brug, og siden ikke beder om billeder, der ikke findes.
export function kommunerMedBillede(): string[] {
  return readdirSync(path.join(process.cwd(), "public/kommuner"))
    .filter((fil) => /^\d{4}\.jpg$/.test(fil))
    .map((fil) => fil.slice(0, 4));
}
