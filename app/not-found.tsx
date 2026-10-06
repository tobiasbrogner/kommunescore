import type { Metadata } from "next";
import NextLink from "next/link";
import { buttonVariants } from "@heroui/styles";
import {
  IconArrowRight,
  IconArrowsLeftRight,
  IconChecklist,
  IconHome,
  IconList,
  IconMap,
} from "@tabler/icons-react";
import { IllustrationIkkeFundet } from "@/components/illustration-ikke-fundet";

export const metadata: Metadata = {
  title: "Siden findes ikke | Kommuna",
};

// Vises ved adresser, der ikke findes, og når en kommune ikke kan slås op (notFound()).
const GENVEJE = [
  { Ikon: IconList, titel: "Alle kommuner", tekst: "Find kommunen på listen.", href: "/kommuner" },
  { Ikon: IconChecklist, titel: "Kommunetesten", tekst: "Svar på et par spørgsmål.", href: "/kommunetest" },
  { Ikon: IconArrowsLeftRight, titel: "Sammenlign", tekst: "Se kommuner side om side.", href: "/sammenlign" },
];

export default function NotFound() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div className="motion-rise-synlig">
          <p className="text-sm font-medium tracking-wide text-accent">Fejl 404</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
            Her er vist ikke nogen kommune.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            Siden findes ikke. Måske er linket gammelt, eller adressen er stavet forkert. Prøv en
            af vejene herunder.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <NextLink href="/" className={buttonVariants({ variant: "primary", size: "lg" })}>
              <IconHome className="h-5 w-5" />
              Forsiden
            </NextLink>
            <NextLink href="/kort" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <IconMap className="h-5 w-5" />
              Kortet
            </NextLink>
          </div>
        </div>

        {/* På mobil står tegningen under teksten og er mindre, så knapperne ses med det samme. */}
        <IllustrationIkkeFundet className="motion-rise motion-delay-1 mx-auto w-full max-w-xs sm:max-w-md lg:max-w-none" />
      </div>

      <ul className="mt-16 grid gap-4 sm:grid-cols-3 lg:mt-20">
        {GENVEJE.map(({ Ikon, titel, tekst, href }) => (
          <li key={href}>
            <NextLink
              href={href}
              className="group flex h-full items-center gap-4 rounded-2xl border border-border/80 bg-surface p-5 transition-colors hover:border-accent/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Ikon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground group-hover:text-accent">
                  {titel}
                </span>
                <span className="mt-0.5 block text-sm text-muted">{tekst}</span>
              </span>
              <IconArrowRight
                className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                aria-hidden="true"
              />
            </NextLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
