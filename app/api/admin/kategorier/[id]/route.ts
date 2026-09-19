import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { kategorier } from "@/lib/db/schema";
import { KOMMUNE_SCORES_TAG } from "@/lib/scores/get-scores";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const { id } = await params;
  const kategoriId = Number(id);
  if (Number.isNaN(kategoriId)) {
    return NextResponse.json({ fejl: "Ugyldigt id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const opdatering: Partial<typeof kategorier.$inferInsert> = {};
  if (typeof body?.navn === "string") opdatering.navn = body.navn.trim();
  if (typeof body?.slug === "string") opdatering.slug = body.slug.trim();
  if (body?.standardvaegt !== undefined) opdatering.standardvaegt = String(Number(body.standardvaegt));
  if (body?.sortering !== undefined) opdatering.sortering = Number(body.sortering);

  const [opdateret] = await db
    .update(kategorier)
    .set(opdatering)
    .where(eq(kategorier.id, kategoriId))
    .returning();

  if (!opdateret) {
    return NextResponse.json({ fejl: "Kategori findes ikke." }, { status: 404 });
  }

  revalidateTag(KOMMUNE_SCORES_TAG, "max");

  return NextResponse.json(opdateret);
}

export async function DELETE(_request: Request, { params }: Context) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const { id } = await params;
  const kategoriId = Number(id);
  if (Number.isNaN(kategoriId)) {
    return NextResponse.json({ fejl: "Ugyldigt id." }, { status: 400 });
  }

  await db.delete(kategorier).where(eq(kategorier.id, kategoriId));
  revalidateTag(KOMMUNE_SCORES_TAG, "max");

  return NextResponse.json({ ok: true });
}
