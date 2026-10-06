import { lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

// Privatlivspolitikken lover, at feedback slettes senest efter 12 måneder. Der er ikke
// noget cron-job, så oprydningen køres, når der kommer ny feedback, og når panelet
// viser listen. Ændres perioden, skal teksten på /privatlivspolitik også rettes.
export async function sletGammelFeedback() {
  await db.delete(feedback).where(lt(feedback.createdAt, sql`now() - interval '12 months'`));
}
