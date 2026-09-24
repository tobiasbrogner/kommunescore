import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { noegletal } from "@/lib/db/schema";
import { KOMMUNE_SCORES_TAG } from "@/lib/scores/get-scores";

const GYLDIGE_RETNINGER = ["hoejere_bedre", "lavere_bedre"] as const;

export async function POST(request: Request) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const navn = typeof body?.navn === "string" ? body.navn.trim() : "";
  const enhed = typeof body?.enhed === "string" ? body.enhed.trim() : "";
  const kategoriId = Number(body?.kategoriId);
  const retning = body?.retning;

  if (
    !navn ||
    !enhed ||
    Number.isNaN(kategoriId) ||
    !GYLDIGE_RETNINGER.includes(retning)
  ) {
    return NextResponse.json(
      { fejl: "navn, enhed, kategoriId og en gyldig retning er påkrævet." },
      { status: 400 },
    );
  }

  const [oprettet] = await db
    .insert(noegletal)
    .values({ navn, enhed, kategoriId, retning })
    .returning();

  revalidateTag(KOMMUNE_SCORES_TAG, { expire: 0 });

  return NextResponse.json(oprettet, { status: 201 });
}
