import type { Metadata } from "next";
import NextLink from "next/link";
import { Card } from "@heroui/react";
import { buttonVariants, linkVariants } from "@heroui/styles";
import {
  IconAdjustmentsHorizontal,
  IconArrowRight,
  IconFileAnalytics,
  IconMap2,
  IconMessageCircle,
  IconShieldCheck,
  IconStar,
} from "@tabler/icons-react";
import { KategoriIkon } from "@/components/ikon";
import { KommuneSoeg } from "@/components/kommune-soeg";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";

export const metadata: Metadata = {
  title: "Kommuna – find den kommune, der passer til dit liv",
  description:
    "Vælg hvad der betyder mest for dig, og se hvordan alle 98 kommuner klarer sig. Bygget på offentlige tal fra bl.a. Danmarks Statistik.",
};

const link = linkVariants();

const TRIN = [
  {
    Ikon: IconAdjustmentsHorizontal,
    titel: "Vælg hvad der betyder noget",
    tekst:
      "Skru op for det, der er vigtigt for dig, og ned for resten. Boligpriser, jobs, børn, tryghed – du bestemmer vægten.",
  },
  {
    Ikon: IconMap2,
    titel: "Se hvem der passer bedst",
    tekst:
      "Kortet farves efter din personlige score, og listen viser kommunerne i rækkefølge. Måske dukker et sted op, du ikke havde tænkt på.",
  },
  {
    Ikon: IconFileAnalytics,
    titel: "Dyk ned i kortlisten",
    tekst:
      "Hver kommune har en rapport med styrker, svagheder og de rå tal sammenlignet med resten af landet.",
  },
];

const VAERKTOEJER = [
  {
    Ikon: IconStar,
    titel: "Gem og del favoritter",
    tekst: "Saml de kommuner, du overvejer, og send listen til dem, du skal flytte med.",
  },
  {
    Ikon: IconMessageCircle,
    titel: "Spørg assistenten",
    tekst: "Stil spørgsmål til tallene i almindeligt sprog, fx hvorfor en kommune scorer højt.",
  },
  {
    Ikon: IconShieldCheck,
    titel: "Åbne kilder",
    tekst: "Alle tal kommer fra offentlige statistikker, og beregningen er beskrevet åbent.",
  },
];

export default async function Home() {
  const { kategorier, kommuner } = await getCachedKommuneScores();

  const kommunenavne = kommuner.map((k) => k.navn).sort((a, b) => a.localeCompare(b, "da"));
  // Samlet score er beregnet med standardvægte – samme udgangspunkt som på kortet.
  const top = [...kommuner].sort((a, b) => b.samlet - a.samlet).slice(0, 5);

  return (
    <main className="overflow-hidden">
      {/* HERO */}
      <section id="start" className="relative">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <div className="motion-rise">
              <p className="mb-5 text-sm font-medium tracking-wide text-accent">
                Alle {kommuner.length} kommuner sammenlignet
              </p>

              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-foreground sm:text-6xl lg:text-7xl">
                Find den kommune,
                <br />
                der passer til
                <br />
                <span className="text-accent">dit liv.</span>
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-8 text-muted sm:text-xl">
                Vælg hvad der betyder mest for dig, og se hvordan Danmarks kommuner klarer sig.
                Bygget på offentlige tal fra bl.a. Danmarks Statistik.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <NextLink
                  href="/kort"
                  className={buttonVariants({ variant: "primary", size: "lg" })}
                >
                  Find din kommune
                  <IconArrowRight className="h-5 w-5" />
                </NextLink>
                <NextLink href="/saadan-virker-det" className={link.base()}>
                  Sådan regner vi
                </NextLink>
              </div>

              <div className="mt-10">
                <p className="mb-3 text-sm text-muted">
                  Kender du allerede en kommune? Slå den op:
                </p>
                <KommuneSoeg kommunenavne={kommunenavne} />
              </div>
            </div>

            <div className="motion-rise motion-delay-1">
              <Card
                variant="secondary"
                className="rounded-[2rem] border border-border/80 shadow-sm"
              >
                <Card.Content className="p-7 sm:p-9">
                  <p className="text-sm font-medium text-muted">Højest samlet score</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Med standardvægtene
                  </h2>

                  <ol className="mt-6 flex flex-col gap-2">
                    {top.map((k, i) => (
                      <li key={k.kode}>
                        <NextLink
                          href={`/kommune/${kommuneSlug(k.navn)}`}
                          className="flex items-center gap-4 rounded-xl border border-border/80 bg-background/85 px-4 py-3 transition-transform duration-300 hover:-translate-y-0.5"
                        >
                          <span className="w-5 text-sm tabular-nums text-muted">{i + 1}</span>
                          <span className="flex-1 font-medium text-foreground">{k.navn}</span>
                          <span className="text-lg font-semibold tabular-nums text-accent">
                            {Math.round(k.samlet)}
                          </span>
                        </NextLink>
                      </li>
                    ))}
                  </ol>

                  <p className="mt-6 text-sm leading-6 text-muted">
                    Men din top 5 ser sikkert anderledes ud. En børnefamilie og en pendler
                    vægter ikke det samme.{" "}
                    <NextLink href="/kort" className="font-medium text-accent hover:underline">
                      Lav din egen
                    </NextLink>
                  </p>
                </Card.Content>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* SÅDAN VIRKER DET */}
      <section
        id="saadan-virker-det"
        className="border-y border-border/70 bg-surface-secondary"
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-accent">Sådan virker det</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
              Fra 98 muligheder til en kortliste.
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted">
              At vælge hvor man skal bo handler om mange ting på én gang. Vi samler tallene ét
              sted, så du kan se, hvilke kommuner der passer til netop dine behov.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {TRIN.map(({ Ikon, titel, tekst }, i) => (
              <Card
                key={titel}
                className="h-full border border-border/80 bg-background transition-transform duration-300 hover:-translate-y-1"
              >
                <Card.Content className="p-6 sm:p-7">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Ikon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-medium tabular-nums text-muted">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">{titel}</h3>
                  <p className="mt-2 leading-7 text-muted">{tekst}</p>
                </Card.Content>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* KATEGORIER */}
      <section id="kategorier">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-sm font-medium tracking-wide text-accent">Det kan du vægte</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                {kategorier.length} kategorier.
                <br />
                Din prioritering.
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted">
                Hver kategori bygger på et eller flere nøgletal. Du kan se præcis hvilke, og
                hvor de kommer fra.
              </p>
              <NextLink
                href="/kilder"
                className={`${link.base()} mt-6 inline-flex items-center gap-1.5`}
              >
                Se alle kilder
                <IconArrowRight className="h-4 w-4" />
              </NextLink>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {kategorier.map((k) => (
                <li
                  key={k.id}
                  className="flex items-start gap-4 rounded-2xl border border-border/80 bg-surface p-5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <KategoriIkon navn={k.ikon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{k.navn}</p>
                    {k.noegletal.length > 0 && (
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {k.noegletal.map((n) => n.navn).join(" · ")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* VÆRKTØJER */}
      <section className="border-y border-border/70 bg-surface-secondary">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-accent">Hjælp til beslutningen</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
              Mere end et kort.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {VAERKTOEJER.map(({ Ikon, titel, tekst }) => (
              <div key={titel} className="flex gap-4">
                <Ikon className="mt-1 h-6 w-6 shrink-0 text-accent" />
                <div>
                  <h3 className="text-lg font-semibold">{titel}</h3>
                  <p className="mt-1 leading-7 text-muted">{tekst}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="om" className="py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card
            variant="secondary"
            className="overflow-hidden rounded-[2rem] border border-border"
          >
            <Card.Content className="p-8 sm:p-12 lg:p-16">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                  Hvor kunne du egentlig trives?
                </h2>
                <p className="mt-5 text-lg leading-8 text-muted">
                  Det tager under et minut at sætte dine prioriteter og se, hvilke kommuner der
                  passer til dig.
                </p>
                <div className="mt-8">
                  <NextLink
                    href="/kort"
                    className={buttonVariants({ variant: "primary", size: "lg" })}
                  >
                    Find din kommune
                    <IconArrowRight className="h-5 w-5" />
                  </NextLink>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>
      </section>
    </main>
  );
}
