import type { PoolConfig } from "pg";

// Fælles forbindelses-opsætning for appen (lib/db) og drizzle-kit.
//
// Hostede databaser (Aiven) bruger et selvsigneret CA-certifikat, som Node
// ikke stoler på. Er DATABASE_CA_CERT sat (PEM-indhold), verificeres
// forbindelsen mod det. sslmode fjernes fra URL'en, fordi pg ellers lader den
// overskrive ssl-objektet og falder tilbage til systemets CA'er.
export function dbConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL mangler — opret .env.local (se .env.example).");
  }

  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  if (!ca) return { connectionString };

  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}
