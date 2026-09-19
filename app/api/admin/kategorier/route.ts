import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { kategorier } from "@/lib/db/schema";
import { KOMMUNE_SCORES_TAG } from "@/lib/scores/get-scores";

export async function POST(request: Request) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const navn = typeof body?.navn === "string" ? body.navn.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const standardvaegt = Number(body?.standardvaegt ?? 1);
  const sortering = Number(body?.sortering ?? 0);

  if (!navn || !slug || Number.isNaN(standardvaegt)) {
    return NextResponse.json({ fejl: "Navn, slug og standardvægt er påkrævet." }, { status: 400 });
  }

  const [oprettet] = await db
    .insert(kategorier)
    .values({ navn, slug, standardvaegt: String(standardvaegt), sortering })
    .returning();

  revalidateTag(KOMMUNE_SCORES_TAG, "max");

  return NextResponse.json(oprettet, { status: 201 });
}
