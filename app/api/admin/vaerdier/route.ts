import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { sql } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { kommuneNoegletal } from "@/lib/db/schema";
import { KOMMUNE_SCORES_TAG } from "@/lib/scores/get-scores";

export async function PUT(request: Request) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const kommuneKode = typeof body?.kommuneKode === "string" ? body.kommuneKode : "";
  const noegletalId = Number(body?.noegletalId);
  const vaerdi = Number(body?.vaerdi);

  if (!kommuneKode || Number.isNaN(noegletalId) || Number.isNaN(vaerdi)) {
    return NextResponse.json(
      { fejl: "kommuneKode, noegletalId og vaerdi er påkrævet." },
      { status: 400 },
    );
  }

  await db
    .insert(kommuneNoegletal)
    .values({ kommuneKode, noegletalId, vaerdi: String(vaerdi) })
    .onConflictDoUpdate({
      target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
      set: { vaerdi: sql`excluded.vaerdi` },
    });

  revalidateTag(KOMMUNE_SCORES_TAG, { expire: 0 });

  return NextResponse.json({ ok: true });
}
