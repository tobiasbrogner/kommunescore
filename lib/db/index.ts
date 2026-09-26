import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { dbConfig } from "./config";
import * as schema from "./schema";

declare global {
  var __kommunescoreDbPool: Pool | undefined;
}

const pool = globalThis.__kommunescoreDbPool ?? new Pool(dbConfig());

if (process.env.NODE_ENV !== "production") {
  globalThis.__kommunescoreDbPool = pool;
}

export const db = drizzle(pool, { schema });
