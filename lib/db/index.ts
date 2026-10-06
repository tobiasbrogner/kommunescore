import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { dbConfig } from "./config";
import * as schema from "./schema";

declare global {
  var __kommunescoreDbPool: Pool | undefined;
}

// Databasen (Aiven) tillader kun 17 forbindelser i alt (20 minus 3 til administratoren),
// og hver serverproces har sin egen pulje: dev-serveren, hver proces i buildet og senere
// produktionen. Derfor højst 5 pr. proces (pg's standard er 10); ledige forbindelser lukkes
// efter 10 sekunder. Kan ændres med DATABASE_POOL_MAX.
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX) || 5;

const pool =
  globalThis.__kommunescoreDbPool ??
  new Pool({ ...dbConfig(), max: POOL_MAX, idleTimeoutMillis: 10_000 });

if (process.env.NODE_ENV !== "production") {
  globalThis.__kommunescoreDbPool = pool;
}

export const db = drizzle(pool, { schema });
