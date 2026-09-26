import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

type Context = { params: Promise<{ id: string }> };

// Markerer feedback som behandlet/ubehandlet.
export async function PATCH(request: Request, { params }: Context) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const id = Number((await params).id);
  const body = await request.json().catch(() => null);

  if (!Number.isInteger(id) || typeof body?.behandlet !== "boolean") {
    return NextResponse.json({ fejl: "Ugyldig forespørgsel." }, { status: 400 });
  }

  await db.update(feedback).set({ behandlet: body.behandlet }).where(eq(feedback.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Context) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ fejl: "Ugyldigt id." }, { status: 400 });
  }

  await db.delete(feedback).where(eq(feedback.id, id));

  return NextResponse.json({ ok: true });
}
