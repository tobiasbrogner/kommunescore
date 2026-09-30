import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { noegletal } from "@/lib/db/schema";
import { KOMMUNE_SCORES_TAG } from "@/lib/scores/get-scores";

type Context = { params: Promise<{ id: string }> };
const GYLDIGE_RETNINGER = ["hoejere_bedre", "lavere_bedre"] as const;
const GYLDIGE_SKALAER = ["lineaer", "logaritmisk"] as const;

export async function PATCH(request: Request, { params }: Context) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const { id } = await params;
  const noegletalId = Number(id);
  if (Number.isNaN(noegletalId)) {
    return NextResponse.json({ fejl: "Ugyldigt id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const opdatering: Partial<typeof noegletal.$inferInsert> = {};
  if (typeof body?.navn === "string") opdatering.navn = body.navn.trim();
  if (typeof body?.enhed === "string") opdatering.enhed = body.enhed.trim();
  if (body?.kategoriId !== undefined) opdatering.kategoriId = Number(body.kategoriId);
  if (body?.retning !== undefined) {
    if (!GYLDIGE_RETNINGER.includes(body.retning)) {
      return NextResponse.json({ fejl: "Ugyldig retning." }, { status: 400 });
    }
    opdatering.retning = body.retning;
  }
  if (body?.skala !== undefined) {
    if (!GYLDIGE_SKALAER.includes(body.skala)) {
      return NextResponse.json({ fejl: "Ugyldig skala." }, { status: 400 });
    }
    opdatering.skala = body.skala;
  }
  if (typeof body?.standardValgt === "boolean") opdatering.standardValgt = body.standardValgt;

  const [opdateret] = await db
    .update(noegletal)
    .set(opdatering)
    .where(eq(noegletal.id, noegletalId))
    .returning();

  if (!opdateret) {
    return NextResponse.json({ fejl: "Nøgletal findes ikke." }, { status: 404 });
  }

  revalidateTag(KOMMUNE_SCORES_TAG, { expire: 0 });

  return NextResponse.json(opdateret);
}

export async function DELETE(_request: Request, { params }: Context) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const { id } = await params;
  const noegletalId = Number(id);
  if (Number.isNaN(noegletalId)) {
    return NextResponse.json({ fejl: "Ugyldigt id." }, { status: 400 });
  }

  await db.delete(noegletal).where(eq(noegletal.id, noegletalId));
  revalidateTag(KOMMUNE_SCORES_TAG, { expire: 0 });

  return NextResponse.json({ ok: true });
}
