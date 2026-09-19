import { NextResponse } from "next/server";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";

export async function GET() {
  const data = await getCachedKommuneScores();
  return NextResponse.json(data);
}
