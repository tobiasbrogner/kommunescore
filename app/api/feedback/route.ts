import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedback, feedbackTypeEnum } from "@/lib/db/schema";
import { erFeedbackRateLimited } from "@/lib/auth/rate-limit";
import { sletGammelFeedback } from "@/lib/feedback-oprydning";

const MIN_BESKED = 5;
const MAKS_BESKED = 4000;
const MAKS_EMAIL = 255;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FeedbackType = (typeof feedbackTypeEnum.enumValues)[number];

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "ukendt";

  if (erFeedbackRateLimited(ip)) {
    return NextResponse.json(
      { fejl: "Du har sendt meget feedback på kort tid. Prøv igen om lidt." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);

  // Honeypot: feltet er skjult for mennesker, så er det udfyldt, er det en bot.
  // Svar "ok" så botten ikke lærer noget.
  if (typeof body?.hjemmeside === "string" && body.hjemmeside.trim()) {
    return NextResponse.json({ ok: true });
  }

  const type = body?.type as FeedbackType;
  if (!feedbackTypeEnum.enumValues.includes(type)) {
    return NextResponse.json({ fejl: "Vælg hvilken slags feedback det er." }, { status: 400 });
  }

  const besked = typeof body?.besked === "string" ? body.besked.trim() : "";
  if (besked.length < MIN_BESKED) {
    return NextResponse.json({ fejl: "Skriv lidt mere, så jeg kan forstå det." }, { status: 400 });
  }
  if (besked.length > MAKS_BESKED) {
    return NextResponse.json(
      { fejl: `Beskeden må højst være ${MAKS_BESKED} tegn.` },
      { status: 400 },
    );
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (email && (email.length > MAKS_EMAIL || !EMAIL_REGEX.test(email))) {
    return NextResponse.json({ fejl: "E-mailadressen ser ikke rigtig ud." }, { status: 400 });
  }

  const side = typeof body?.side === "string" ? body.side.slice(0, 500) : null;
  const brugeragent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  await db.insert(feedback).values({
    type,
    besked,
    email: email || null,
    side,
    brugeragent,
  });
  await sletGammelFeedback();

  return NextResponse.json({ ok: true });
}
