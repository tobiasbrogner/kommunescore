import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { KOMMUNE_SCORES_TAG } from "@/lib/scores/get-scores";

// Kaldes af seed-scripts (scripts/_revalider.ts), som skriver direkte til
// databasen uden om Next.js og derfor ikke selv kan rydde cachen. Beskyttet af
// en delt hemmelighed i REVALIDATE_SECRET i stedet for admin-login.
function gyldigHemmelighed(modtaget: string | null) {
  const forventet = process.env.REVALIDATE_SECRET;
  if (!forventet || !modtaget) return false;
  const a = Buffer.from(modtaget);
  const b = Buffer.from(forventet);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!gyldigHemmelighed(request.headers.get("x-revalidate-secret"))) {
    return NextResponse.json({ fejl: "Ugyldig nøgle." }, { status: 401 });
  }

  // expire: 0 udløber data med det samme, så næste request ikke får den gamle version.
  revalidateTag(KOMMUNE_SCORES_TAG, { expire: 0 });
  return NextResponse.json({ revalideret: true });
}
