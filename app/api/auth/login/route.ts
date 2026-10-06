import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { administratorer } from "@/lib/db/schema";
import { verifyPassword, DUMMY_HASH } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { erLoginLoftNaaet, erRateLimited } from "@/lib/auth/rate-limit";
import { klientIp } from "@/lib/klient-ip";

const GENERISK_FEJL = "Forkert e-mail eller adgangskode.";

export async function POST(request: Request) {
  // Både grænsen pr. IP og det samlede loft tælles hver gang (ingen kortslutning).
  const forMangeFraIp = erRateLimited(klientIp(request));
  const forMangeIAlt = erLoginLoftNaaet("alle");
  if (forMangeFraIp || forMangeIAlt) {
    return NextResponse.json(
      { fejl: "For mange loginforsøg. Prøv igen senere." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ fejl: GENERISK_FEJL }, { status: 400 });
  }

  const [administrator] = await db
    .select({ id: administratorer.id, passwordHash: administratorer.passwordHash })
    .from(administratorer)
    .where(eq(administratorer.email, email))
    .limit(1);

  // Kør altid en hash-verify, også når e-mailen ikke findes — ellers kan
  // svartiden bruges til at afgøre om en e-mail er registreret.
  const gyldig = await verifyPassword(administrator?.passwordHash ?? DUMMY_HASH, password);

  if (!administrator || !gyldig) {
    return NextResponse.json({ fejl: GENERISK_FEJL }, { status: 401 });
  }

  await createSession(administrator.id);

  return NextResponse.json({ ok: true });
}
