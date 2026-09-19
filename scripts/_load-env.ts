// Skal importeres FØRST (før @/lib/db) i ethvert script kørt via tsx uden om
// Next.js' egen runtime. ES-modul-imports evalueres i den rækkefølge de er
// skrevet, så denne fils top-niveau-kald til loadEnvConfig() når at køre før
// @/lib/db læser process.env.DATABASE_URL — kald aldrig loadEnvConfig() som
// en almindelig sætning nede i selve scriptet, det når for sent.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
