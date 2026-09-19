import "./_load-env";

import { db } from "@/lib/db";
import { administratorer } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const force = process.argv.includes("--force");
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL og ADMIN_PASSWORD skal være sat i .env.local, før scriptet kan køre.",
    );
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD skal være mindst 12 tegn.");
  }

  const eksisterende = await db.select({ id: administratorer.id }).from(administratorer);

  if (eksisterende.length > 0 && !force) {
    throw new Error(
      `Der findes allerede ${eksisterende.length} administrator(er). Kør med --force hvis du bevidst vil oprette en til.`,
    );
  }

  const passwordHash = await hashPassword(password);
  const [oprettet] = await db
    .insert(administratorer)
    .values({ email, passwordHash })
    .returning({ id: administratorer.id, email: administratorer.email });

  console.log(`Oprettede administrator #${oprettet.id} (${oprettet.email}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
