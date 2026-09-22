import type { Metadata } from "next";
import { DanmarkKort } from "@/components/danmark-kort";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";

export const metadata: Metadata = {
  title: "Kort | Danmarkskortet",
  description: "Udforsk Danmarks kommuner på et interaktivt kort.",
};

export default async function KortSide() {
  const { kategorier, kommuner: kommuneScores } = await getCachedKommuneScores();

  return (
    <main>
      <section className="border-b border-border/70 bg-surface-secondary">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Udforsk kortet.
          </h1>
          <p className="mt-2 max-w-xl text-base leading-7 text-muted">
            Søg efter en kommune, eller klik direkte på kortet, for at se den
            fremhævet.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <DanmarkKort kategorier={kategorier} kommuneScores={kommuneScores} />
      </section>
    </main>
  );
}
