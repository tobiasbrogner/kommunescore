import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { kommuner } from "@/lib/db/schema";

type Context = { params: Promise<{ kode: string }> };

const MAKS_BY = 100;
const MAKS_BESKRIVELSE = 2000;

// Opdaterer teksterne til "Om [kommune]" på rapportsiden. Tomme felter gemmes som null.
export async function PATCH(request: Request, { params }: Context) {
  const administrator = await verifySession();
  if (!administrator) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  const { kode } = await params;
  const body = await request.json().catch(() => null);
  const opdatering: Partial<typeof kommuner.$inferInsert> = {};

  if (body?.stoersteBy !== undefined) {
    const by = typeof body.stoersteBy === "string" ? body.stoersteBy.trim() : "";
    if (by.length > MAKS_BY) {
      return NextResponse.json({ fejl: `Største by må højst være ${MAKS_BY} tegn.` }, { status: 400 });
    }
    opdatering.stoersteBy = by || null;
  }
  if (body?.beskrivelse !== undefined) {
    const tekst = typeof body.beskrivelse === "string" ? body.beskrivelse.trim() : "";
    if (tekst.length > MAKS_BESKRIVELSE) {
      return NextResponse.json(
        { fejl: `Beskrivelsen må højst være ${MAKS_BESKRIVELSE} tegn.` },
        { status: 400 },
      );
    }
    opdatering.beskrivelse = tekst || null;
  }

  if (Object.keys(opdatering).length === 0) {
    return NextResponse.json({ fejl: "Intet at opdatere." }, { status: 400 });
  }

  const [opdateret] = await db
    .update(kommuner)
    .set(opdatering)
    .where(eq(kommuner.kode, kode))
    .returning();

  if (!opdateret) {
    return NextResponse.json({ fejl: "Kommune findes ikke." }, { status: 404 });
  }

  return NextResponse.json(opdateret);
}
