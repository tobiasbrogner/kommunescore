import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

declare global {
  var __kommunescoreDbPool: Pool | undefined;
}

const pool =
  globalThis.__kommunescoreDbPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalThis.__kommunescoreDbPool = pool;
}

export const db = drizzle(pool, { schema });
