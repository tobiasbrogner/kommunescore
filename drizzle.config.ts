import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { dbConfig } from "./lib/db/config";

loadEnvConfig(process.cwd());

const { connectionString, ssl } = dbConfig();
const url = new URL(connectionString!);

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: ssl
    ? {
        host: url.hostname,
        port: Number(url.port) || 5432,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: ssl as object,
      }
    : { url: connectionString! },
});
