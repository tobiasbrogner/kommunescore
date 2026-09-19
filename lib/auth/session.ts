import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessioner } from "@/lib/db/schema";

export const SESSION_COOKIE = "session";
const SESSION_LEVETID_MS = 7 * 24 * 60 * 60 * 1000; // 7 dage

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(administratorId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_LEVETID_MS);

  await db.insert(sessioner).values({
    administratorId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessioner).where(eq(sessioner.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

// Den autoritative kontrol: slår token op i databasen og tjekker udløb.
// Kaldes altid server-side (layout/route handler) — proxy.ts laver kun et
// billigt "findes cookien"-tjek og må ikke bruges alene til autorisation.
export async function getSessionAdministratorId(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [session] = await db
    .select({ administratorId: sessioner.administratorId, expiresAt: sessioner.expiresAt })
    .from(sessioner)
    .where(eq(sessioner.tokenHash, hashToken(token)))
    .limit(1);

  if (!session || session.expiresAt.getTime() < Date.now()) return null;

  return session.administratorId;
}
