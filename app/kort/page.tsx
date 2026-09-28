import type { Metadata } from "next";
import { DanmarkKort } from "@/components/danmark-kort";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";

export const metadata: Metadata = {
  title: "Kort | TestProjekt",
  description: "Udforsk Danmarks kommuner på et interaktivt kort.",
};

export default async function KortSide() {
  const { kategorier, kommuner: kommuneScores } = await getCachedKommuneScores();

  return (
    <main>
      <h1 className="sr-only">Udforsk kortet</h1>
      <DanmarkKort kategorier={kategorier} kommuneScores={kommuneScores} />
    </main>
  );
}
