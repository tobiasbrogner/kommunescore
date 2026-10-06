import type { Metadata } from "next";
import NextLink from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Broedkrummer } from "@/components/json-ld";
import { KommuneSoeg } from "@/components/kommune-soeg";
import { byggKommuneFliser } from "@/lib/kommuner/fliser";
import { sammenlignKommunenavne } from "@/lib/kommuner/navn";
import { REGION_NAVNE } from "@/lib/kommuner/regioner";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";

export const metadata: Metadata = {
  title: "Alle 98 kommuner i Danmark | Kommuna",
  description:
    "Se alle Danmarks 98 kommuner fordelt på de fem regioner. Åbn en kommunes rapport med score, styrker og tal om boligpriser, skat, natur, tryghed og meget mere.",
  alternates: { canonical: "/kommuner" },
};

// Oversigt over alle kommuner, delt op efter region. Siden linker til hver rapport, så
// forsiden kan nøjes med et udvalg.
export default async function KommunerSide() {
  const { kommuner } = await getCachedKommuneScores();
  const fliser = await byggKommuneFliser(kommuner);

  const regioner = Object.values(REGION_NAVNE)
    .map((region) => ({
      region,
      kommuner: fliser
        .filter((f) => f.region === region)
        .sort((a, b) => sammenlignKommunenavne(a.navn, b.navn)),
    }))
    .filter((r) => r.kommuner.length > 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <Broedkrummer sti={[["Kommuner", "/kommuner"]]} />
      <header className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium tracking-wide text-accent">Alle kommuner</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Danmarks {kommuner.length} kommuner
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted">
            Find en kommune og se dens rapport med score, styrker og alle tallene. Scoren er ud
            af 100 og beregnet med standardvægtene.
          </p>
        </div>
        <div className="w-full lg:max-w-md">
          <KommuneSoeg kommunenavne={fliser.map((k) => k.navn)} />
        </div>
      </header>

      <div className="mt-14 flex flex-col gap-12">
        {regioner.map(({ region, kommuner: liste }) => (
          <section key={region} aria-labelledby={`region-${liste[0].kode}`}>
            <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
              <h2 id={`region-${liste[0].kode}`} className="text-xl font-semibold tracking-tight">
                {region}
              </h2>
              <p className="text-sm text-muted">{liste.length} kommuner</p>
            </div>
            <ul className="mt-2 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {liste.map((k) => (
                <li key={k.kode}>
                  <NextLink
                    href={`/kommune/${k.slug}`}
                    className="group flex items-center justify-between gap-3 border-b border-border/60 py-3 transition-colors hover:text-accent"
                  >
                    <span className="truncate font-medium">{k.navn}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs tabular-nums text-muted">Nr. {k.rang}</span>
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold tabular-nums text-accent"
                        title="Samlet score ud af 100"
                      >
                        {k.score}
                      </span>
                    </span>
                  </NextLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-muted">Vil du se placeringen efter dine egne prioriteter?</p>
        <NextLink
          href="/kort"
          className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
        >
          Åbn kortet
          <IconArrowRight className="h-4 w-4" />
        </NextLink>
      </div>
    </main>
  );
}
