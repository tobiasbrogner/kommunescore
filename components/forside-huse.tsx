"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import NextLink from "next/link";
import { IconArrowRight, IconHome, IconTrendingUp } from "@tabler/icons-react";
import { KategoriIkon } from "@/components/ikon";

export type ForsideHus = {
  kode: string;
  navn: string;
  slug: string;
  region: string | null;
  harBillede: boolean;
  score: number;
  rang: number;
  antal: number;
  /** Kommunens to største styrker, som i rapporten. */
  styrker: { navn: string; ikon: string | null; tekst: string }[];
  /** Placering i billedet i procent af bredde og højde. */
  x: number;
  y: number;
};

// Lidt luft, så boksen ikke blinker, når musen glider fra ét hus til et andet.
const LUK_FORSINKELSE = 150;

// Husene på forsidens Danmarkskort. Musen eller tastaturfokus på et hus åbner en boks med
// kommunens tal, som lukker igen, når musen eller fokus forlader huset. Boksen står forrest,
// men musen går igennem den, så et hus, den dækker, stadig kan vælges. Huset åbner kortet
// med kommunen valgt i et nyt faneblad, så forsiden bliver stående; på mobilen går et tryk
// direkte dertil.
export function ForsideHuse({ huse }: { huse: ForsideHus[] }) {
  const [aktiv, setAktiv] = useState<number | null>(null);
  const lukTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const valgt = aktiv === null ? undefined : huse[aktiv];

  const aabn = (i: number) => {
    clearTimeout(lukTimer.current);
    setAktiv(i);
  };
  const lukSnart = () => {
    clearTimeout(lukTimer.current);
    lukTimer.current = setTimeout(() => setAktiv(null), LUK_FORSINKELSE);
  };
  useEffect(() => () => clearTimeout(lukTimer.current), []);

  // Boksen åbner under huset i kortets øverste halvdel og over det i den nederste, og
  // aldrig ud over billedets sider. På mobil (uden mus) vises den ikke.
  const vandret = !valgt ? "" : valgt.x > 62 ? "-translate-x-full" : valgt.x < 38 ? "" : "-translate-x-1/2";
  const lodret = !valgt || valgt.y < 45 ? "mt-7" : "-mt-7 -translate-y-full";

  return (
    <>
      {/* Husenes fotos hentes på forhånd (samme små udgaver som i boksen), så de står klar,
          når boksen åbner. */}
      <div className="hidden" aria-hidden="true">
        {huse.map((hus) =>
          hus.harBillede ? (
            <Image key={hus.kode} src={`/kommuner/${hus.kode}.jpg`} alt="" width={256} height={80} sizes="256px" loading="eager" />
          ) : null,
        )}
      </div>

      {huse.map((hus, i) => (
        <NextLink
          key={hus.slug}
          href={`/kort?kommune=${hus.slug}`}
          target="_blank"
          rel="noopener"
          aria-label={`${hus.navn}: samlet score ${hus.score}, nr. ${hus.rang} af ${hus.antal}. Se den på kortet (åbner i nyt vindue)`}
          onMouseEnter={() => aabn(i)}
          onMouseLeave={lukSnart}
          onFocus={() => aabn(i)}
          onBlur={lukSnart}
          className={`absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-md ring-4 ring-background transition-transform duration-200 hover:scale-110 focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            i === aktiv ? "bg-accent text-accent-foreground" : "bg-foreground text-background"
          }`}
          style={{ left: `${hus.x}%`, top: `${hus.y}%` }}
        >
          <IconHome className="h-5 w-5" aria-hidden="true" />
        </NextLink>
      ))}

      {valgt && (
        // Kun til at se på: skærmlæsere og tastatur får det samme fra linket på huset.
        <div
          key={valgt.slug}
          aria-hidden="true"
          className={`pointer-events-none absolute z-30 hidden w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl sm:block ${vandret} ${lodret}`}
          style={{ left: `${valgt.x}%`, top: `${valgt.y}%` }}
        >
          <div className="relative h-20 bg-gradient-to-br from-surface-secondary to-accent/10">
            {valgt.harBillede ? (
              <Image
                src={`/kommuner/${valgt.kode}.jpg`}
                alt=""
                fill
                sizes="256px"
                className="object-cover"
              />
            ) : (
              <IconHome className="absolute inset-0 m-auto h-7 w-7 text-muted/50" />
            )}
          </div>

          <div className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight text-foreground">{valgt.navn}</p>
                {valgt.region && <p className="mt-0.5 truncate text-xs text-muted">{valgt.region}</p>}
              </div>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold tabular-nums text-accent-foreground"
                title="Samlet score ud af 100"
              >
                {valgt.score}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted tabular-nums">
              Nr. {valgt.rang} af {valgt.antal} kommuner
            </p>

            {valgt.styrker.length > 0 && (
              <div className="mt-2.5 border-t border-border pt-2.5">
                <p className="flex items-center gap-1 text-xs font-medium text-success">
                  <IconTrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Styrker
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {valgt.styrker.map((s) => (
                    <li key={s.navn} className="flex items-start gap-2 text-xs">
                      <KategoriIkon navn={s.ikon} className="mt-px h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="font-medium text-foreground">{s.navn}</span>
                        <span className="text-muted"> · {s.tekst}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-2.5 flex items-center gap-1 text-xs font-medium text-accent">
              Klik på huset for at se den på kortet <IconArrowRight className="h-3.5 w-3.5" />
            </p>
          </div>
        </div>
      )}
    </>
  );
}
