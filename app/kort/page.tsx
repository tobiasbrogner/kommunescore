import type { Metadata } from "next";
import { DanmarkKort } from "@/components/danmark-kort";

export const metadata: Metadata = {
  title: "Kort | Danmarkskortet",
  description: "Udforsk Danmarks kommuner på et interaktivt kort.",
};

export default function KortSide() {
  return (
    <main>
      <section className="border-b border-border/70 bg-surface-secondary">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-sm font-medium tracking-wide text-accent">
            Danmarkskortet
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Udforsk kortet.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            Søg efter en kommune, eller klik direkte på kortet, for at se den
            fremhævet.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <DanmarkKort />
      </section>
    </main>
  );
}
