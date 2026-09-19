import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { administratorer } from "@/lib/db/schema";
import { getSessionAdministratorId } from "@/lib/auth/session";

// Memoized pr. request, så flere kald (layout + side) ikke slår sessionen op
// i databasen mere end én gang.
export const verifySession = cache(async () => {
  const administratorId = await getSessionAdministratorId();
  if (!administratorId) return null;

  const [administrator] = await db
    .select({ id: administratorer.id, email: administratorer.email })
    .from(administratorer)
    .where(eq(administratorer.id, administratorId))
    .limit(1);

  return administrator ?? null;
});

export async function verifySessionOrRedirect() {
  const administrator = await verifySession();
  if (!administrator) redirect("/panel/login");
  return administrator;
}
