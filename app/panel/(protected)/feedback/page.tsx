import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { FeedbackManager } from "@/components/panel/feedback-manager";
import { sletGammelFeedback } from "@/lib/feedback-oprydning";

export default async function PanelFeedbackPage() {
  await sletGammelFeedback();
  const alFeedback = await db
    .select({
      id: feedback.id,
      type: feedback.type,
      besked: feedback.besked,
      email: feedback.email,
      side: feedback.side,
      brugeragent: feedback.brugeragent,
      behandlet: feedback.behandlet,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .orderBy(desc(feedback.createdAt));

  return (
    <FeedbackManager
      feedback={alFeedback.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))}
    />
  );
}
