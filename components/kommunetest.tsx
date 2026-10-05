"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import NextLink from "next/link";
import { Button, Card, ProgressBar, Slider } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowsLeftRight,
  IconCheck,
  IconClock,
  IconHome,
  IconMap,
  IconRefresh,
} from "@tabler/icons-react";
import { IllustrationKontrolpanel } from "@/components/illustration-kontrolpanel";
import { KategoriIkon } from "@/components/ikon";
import {
  HELE_LANDET,
  OMRAADER,
  VIGTIGHED_STANDARD,
  VIGTIGHED_TRIN,
  byggPrioritet,
  findMatch,
  synligeSpoergsmaal,
  type Mulighed,
  type Spoergsmaal,
  type Svar,
} from "@/lib/kommunetest";
import type { KategoriMeta, KommuneScore } from "@/lib/scores/compute";
import { prioritetTilParametre } from "@/lib/scores/prioritet-link";

type TestKommuneData = {
  kode: string;
  navn: string;
  slug: string;
  regionskode: string;
  region: string | null;
  harBillede: boolean;
};

const ANTAL_RESULTATER = 6;
// Svarene huskes i fanen, så en genindlæsning ikke sender en tilbage til start.
const LAGER = "kommuna-kommunetest";
// Efter et valg går testen videre af sig selv, men så langsomt, at man ser markeringen.
const VIDERE_EFTER_MS = 220;

type Trin = "intro" | number | "resultat";

export function Kommunetest({
  kategorier,
  scorer,
  kommuner,
}: {
  kategorier: KategoriMeta[];
  scorer: KommuneScore[];
  kommuner: TestKommuneData[];
}) {
  const [trin, setTrin] = useState<Trin>("intro");
  const [svar, setSvar] = useState<Svar>({});
  const overskriftRef = useRef<HTMLHeadingElement>(null);
  const videreTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    try {
      const gemt = JSON.parse(sessionStorage.getItem(LAGER) ?? "null") as {
        trin: Trin;
        svar: Svar;
      } | null;
      if (gemt?.svar) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage findes kun i browseren.
        setSvar(gemt.svar);
        setTrin(gemt.trin);
      }
    } catch {}
    return () => clearTimeout(videreTimer.current);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(LAGER, JSON.stringify({ trin, svar }));
    } catch {}
  }, [trin, svar]);

  // Nyt trin: start øverst, og flyt fokus til overskriften, så skærmlæsere læser spørgsmålet.
  useEffect(() => {
    if (trin === "intro") return;
    window.scrollTo({ top: 0 });
    overskriftRef.current?.focus({ preventScroll: true });
  }, [trin]);

  const synlige = synligeSpoergsmaal(svar);
  const index = typeof trin === "number" ? Math.min(trin, synlige.length - 1) : 0;
  const spoergsmaal = synlige[index];

  const naeste = () => setTrin(index + 1 >= synlige.length ? "resultat" : index + 1);
  const forrige = () => setTrin(index === 0 ? "intro" : index - 1);
  const start = () => {
    setSvar({});
    setTrin(0);
  };

  if (trin === "intro") {
    return <Intro onStart={start} fortsaet={Object.keys(svar).length > 0 ? () => setTrin(0) : undefined} />;
  }

  if (trin === "resultat") {
    return (
      <Resultat
        svar={svar}
        kategorier={kategorier}
        scorer={scorer}
        kommuner={kommuner}
        overskriftRef={overskriftRef}
        onRet={() => setTrin(synlige.length - 1)}
        onIgen={start}
      />
    );
  }

  const vaelg = (id: string) => {
    if (spoergsmaal.type !== "valg") return;
    if (spoergsmaal.flere) {
      const nu = Array.isArray(svar[spoergsmaal.id]) ? (svar[spoergsmaal.id] as string[]) : [];
      // "Hele landet" udelukker de enkelte områder og omvendt.
      const nyt =
        id === HELE_LANDET
          ? nu.includes(id) ? [] : [id]
          : nu.includes(id)
            ? nu.filter((x) => x !== id)
            : [...nu.filter((x) => x !== HELE_LANDET), id];
      setSvar((s) => ({ ...s, [spoergsmaal.id]: nyt }));
      return;
    }
    setSvar((s) => ({ ...s, [spoergsmaal.id]: id }));
    clearTimeout(videreTimer.current);
    videreTimer.current = setTimeout(naeste, VIDERE_EFTER_MS);
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onPress={forrige}>
          <IconArrowLeft className="h-4 w-4" />
          Tilbage
        </Button>
        <span className="text-sm tabular-nums text-muted">
          Spørgsmål {index + 1} af {synlige.length}
        </span>
      </div>
      <ProgressBar
        aria-label="Hvor langt du er i testen"
        value={index}
        maxValue={synlige.length}
        size="sm"
        className="mt-3"
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      <Card className="mt-6 border border-border/80">
        <Card.Content className="p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            {spoergsmaal.afsnit}
          </p>
          <h1
            ref={overskriftRef}
            tabIndex={-1}
            className="mt-2 text-2xl font-semibold tracking-tight text-pretty outline-none sm:text-3xl"
          >
            {spoergsmaal.titel}
          </h1>
          <Hjaelp spoergsmaal={spoergsmaal} svar={svar} />

          {spoergsmaal.type === "valg" ? (
            <Valg
              key={spoergsmaal.id}
              spoergsmaal={spoergsmaal}
              muligheder={
                typeof spoergsmaal.muligheder === "function"
                  ? spoergsmaal.muligheder(svar, kategorier)
                  : spoergsmaal.muligheder
              }
              valgt={svar[spoergsmaal.id]}
              onVaelg={vaelg}
              onNaeste={naeste}
            />
          ) : (
            <Vigtighed
              key={spoergsmaal.id}
              kategori={kategorier.find((k) => k.slug === spoergsmaal.kategori)}
              vaerdi={
                typeof svar[spoergsmaal.id] === "number"
                  ? (svar[spoergsmaal.id] as number)
                  : VIGTIGHED_STANDARD
              }
              onAendr={(v) => setSvar((s) => ({ ...s, [spoergsmaal.id]: v }))}
              onNaeste={() => {
                // Står slideren urørt, gælder standardværdien som svar.
                setSvar((s) => ({ ...s, [spoergsmaal.id]: s[spoergsmaal.id] ?? VIGTIGHED_STANDARD }));
                naeste();
              }}
            />
          )}
        </Card.Content>
      </Card>
    </main>
  );
}

function Intro({ onStart, fortsaet }: { onStart: () => void; fortsaet?: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      <div className="grid items-center gap-12 md:grid-cols-[1fr_minmax(0,22rem)]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Kommunetesten</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Find de kommuner, der passer til dig
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            Svar på 20 korte spørgsmål om, hvor i landet du vil bo, og hvad der betyder mest for
            dig. Så finder vi de seks kommuner, der passer bedst, ud fra tal for alle 98 kommuner.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onPress={onStart}>
              Start testen
              <IconArrowRight className="h-5 w-5" />
            </Button>
            {fortsaet && (
              <Button variant="outline" size="lg" onPress={fortsaet}>
                Fortsæt, hvor du slap
              </Button>
            )}
          </div>
          <p className="mt-5 flex items-center gap-1.5 text-sm text-muted">
            <IconClock className="h-4 w-4" />
            Tager cirka 3 minutter. Dine svar bliver kun i din browser.
          </p>
        </div>
        <IllustrationKontrolpanel className="hidden w-full md:block" />
      </div>
    </main>
  );
}

function Hjaelp({ spoergsmaal, svar }: { spoergsmaal: Spoergsmaal; svar: Svar }) {
  const tekst = typeof spoergsmaal.hjaelp === "function" ? spoergsmaal.hjaelp(svar) : spoergsmaal.hjaelp;
  return tekst ? <p className="mt-3 text-pretty text-muted">{tekst}</p> : null;
}

function Valg({
  spoergsmaal,
  muligheder,
  valgt,
  onVaelg,
  onNaeste,
}: {
  spoergsmaal: Extract<Spoergsmaal, { type: "valg" }>;
  muligheder: Mulighed[];
  valgt: Svar[string] | undefined;
  onVaelg: (id: string) => void;
  onNaeste: () => void;
}) {
  const erValgt = (id: string) => (Array.isArray(valgt) ? valgt.includes(id) : valgt === id);
  const mange = muligheder.length > 5;

  return (
    <div className="mt-8">
      <div
        role="group"
        aria-label={spoergsmaal.titel}
        className={`grid gap-3 ${mange ? "sm:grid-cols-2" : ""}`}
      >
        {muligheder.map((m) => {
          const aktiv = erValgt(m.id);
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={aktiv}
              onClick={() => onVaelg(m.id)}
              className={`flex w-full cursor-pointer items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                aktiv
                  ? "border-accent bg-accent/8"
                  : "border-border bg-surface hover:border-accent/50 hover:bg-surface-secondary"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{m.label}</span>
                {m.tekst && <span className="mt-0.5 block text-sm text-muted">{m.tekst}</span>}
              </span>
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center border transition-colors ${
                  spoergsmaal.flere ? "rounded-md" : "rounded-full"
                } ${aktiv ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}
              >
                {aktiv && <IconCheck className="h-4 w-4" stroke={3} />}
              </span>
            </button>
          );
        })}
      </div>

      {spoergsmaal.flere && (
        // På mobil står knappen fast i bunden, så den ikke gemmer sig under mulighederne.
        <div className="mt-8 flex justify-end max-sm:sticky max-sm:bottom-4">
          <Button
            variant="primary"
            className="max-sm:shadow-lg"
            isDisabled={!Array.isArray(valgt) || valgt.length === 0}
            onPress={onNaeste}
          >
            Næste
            <IconArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function Vigtighed({
  kategori,
  vaerdi,
  onAendr,
  onNaeste,
}: {
  kategori: KategoriMeta | undefined;
  vaerdi: number;
  onAendr: (v: number) => void;
  onNaeste: () => void;
}) {
  const trin = Math.round(vaerdi / 25);
  return (
    <div className="mt-8">
      <div className="flex items-center gap-4 rounded-2xl bg-surface-secondary px-5 py-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <KategoriIkon navn={kategori?.ikon ?? null} className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted">{kategori?.navn}</p>
          <p className="text-xl font-semibold text-foreground" aria-live="polite">
            {VIGTIGHED_TRIN[trin]}
          </p>
        </div>
      </div>

      <Slider
        className="mt-8 w-full"
        minValue={0}
        maxValue={100}
        step={25}
        value={vaerdi}
        onChange={(v) => onAendr(Array.isArray(v) ? v[0] : v)}
        aria-label={`Hvor vigtigt er ${kategori?.navn.toLowerCase() ?? "det"}?`}
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      {/* Trinene under slideren kan også trykkes på. På mobil kun yderpunkterne. */}
      <div className="mt-3 grid grid-cols-5 text-xs text-muted">
        {VIGTIGHED_TRIN.map((navn, i) => (
          <button
            key={navn}
            type="button"
            onClick={() => onAendr(i * 25)}
            className={`cursor-pointer ${i === 0 ? "text-left" : i === 4 ? "text-right" : "max-sm:invisible text-center"} ${
              i === trin ? "font-medium text-foreground" : "hover:text-foreground"
            }`}
          >
            {navn}
          </button>
        ))}
      </div>

      <div className="mt-10 flex justify-end">
        <Button variant="primary" onPress={onNaeste}>
          Næste
          <IconArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Resultat({
  svar,
  kategorier,
  scorer,
  kommuner,
  overskriftRef,
  onRet,
  onIgen,
}: {
  svar: Svar;
  kategorier: KategoriMeta[];
  scorer: KommuneScore[];
  kommuner: TestKommuneData[];
  overskriftRef: React.RefObject<HTMLHeadingElement | null>;
  onRet: () => void;
  onIgen: () => void;
}) {
  const prioritet = useMemo(() => byggPrioritet(svar, kategorier), [svar, kategorier]);
  const matches = useMemo(
    () => findMatch(prioritet, kategorier, scorer, kommuner),
    [prioritet, kategorier, scorer, kommuner],
  );
  const top = matches.slice(0, ANTAL_RESULTATER);
  const kommunePrKode = new Map(kommuner.map((k) => [k.kode, k]));

  const omraadeNavne = OMRAADER.filter((o) => prioritet.omraader?.includes(o.id)).map((o) => o.label);
  const omraadeTekst =
    omraadeNavne.length === 0
      ? "hele landet"
      : omraadeNavne.length === 1
        ? omraadeNavne[0]
        : `${omraadeNavne.slice(0, -1).join(", ")} og ${omraadeNavne.at(-1)}`;

  // Det, brugeren vægtede højest, så resultatet kan forklares.
  const vigtigste = kategorier
    .map((k) => ({ kategori: k, vaegt: prioritet.vaegte[k.slug] ?? 0 }))
    .filter((v) => v.vaegt > 0)
    .sort((a, b) => b.vaegt - a.vaegt);
  const maksVaegt = Math.max(1, ...vigtigste.map((v) => v.vaegt));

  const params = prioritetTilParametre(prioritet);
  const kortLink = `/kort${params.size > 0 ? `?${params}` : ""}`;
  const sammenlignLink = `/sammenlign?kommuner=${top
    .slice(0, 4)
    .flatMap((m) => kommunePrKode.get(m.kode)?.slug ?? [])
    .join(",")}`;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">Kommunetesten</p>
      <h1
        ref={overskriftRef}
        tabIndex={-1}
        className="mt-2 text-3xl font-semibold tracking-tight outline-none sm:text-5xl"
      >
        Din top {Math.min(ANTAL_RESULTATER, top.length)}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        De kommuner i {omraadeTekst}
        {prioritet.udenOeer ? " (uden øer uden bro)" : ""}, der passer bedst til dine svar.
      </p>

      {top.length === 0 ? (
        <p className="mt-10 text-muted">Ingen kommuner passer til dit område. Prøv at vælge flere.</p>
      ) : (
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((m, i) => {
            const k = kommunePrKode.get(m.kode);
            if (!k) return null;
            return (
              <li key={m.kode}>
                <ResultatKort kommune={k} plads={i + 1} score={m.score} styrker={m.styrker} />
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <NextLink href={kortLink} className={buttonVariants({ variant: "primary" })}>
          <IconMap className="h-4 w-4" />
          Se din rangering på kortet
        </NextLink>
        {top.length >= 2 && (
          <NextLink href={sammenlignLink} className={buttonVariants({ variant: "outline" })}>
            <IconArrowsLeftRight className="h-4 w-4" />
            Sammenlign top {Math.min(4, top.length)}
          </NextLink>
        )}
        <Button variant="ghost" onPress={onRet}>
          <IconArrowLeft className="h-4 w-4" />
          Ret dine svar
        </Button>
        <Button variant="ghost" onPress={onIgen}>
          <IconRefresh className="h-4 w-4" />
          Tag testen igen
        </Button>
      </div>

      <Card variant="secondary" className="mt-12 border border-border">
        <Card.Content className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-xl font-semibold">Sådan har vi regnet</h2>
            <p className="mt-3 text-pretty text-muted">
              Dine svar er blevet til en vægt for hver kategori. Scoren er et vægtet gennemsnit af
              kommunens kategoriscorer fra 50 til 100, så de kategorier, du vægter højt, tæller
              mest. På kortet kan du se hele listen og justere vægtene selv.
            </p>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-x-8">
            {vigtigste.map(({ kategori, vaegt }) => (
              <li key={kategori.id} className="flex items-center gap-3 text-sm">
                <KategoriIkon navn={kategori.ikon} className="h-4 w-4 shrink-0 text-muted" />
                <span className="w-28 shrink-0 truncate text-foreground">{kategori.navn}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${(vaegt / maksVaegt) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>
    </main>
  );
}

function ResultatKort({
  kommune,
  plads,
  score,
  styrker,
}: {
  kommune: TestKommuneData;
  plads: number;
  score: number;
  styrker: string[];
}) {
  return (
    <NextLink
      href={`/kommune/${kommune.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface transition-colors hover:border-accent/60"
    >
      <div className="relative h-36 bg-gradient-to-br from-surface-secondary to-accent/10">
        {kommune.harBillede ? (
          <Image
            src={`/kommuner/${kommune.kode}.jpg`}
            alt=""
            fill
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <IconHome className="absolute inset-0 m-auto h-7 w-7 text-muted/50" />
        )}
        <span className="absolute left-3 top-3 flex h-8 min-w-8 items-center justify-center rounded-full bg-background/90 px-2 text-sm font-bold tabular-nums text-foreground shadow-sm">
          {plads}.
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight text-foreground">{kommune.navn}</p>
            {kommune.region && <p className="mt-0.5 truncate text-xs text-muted">{kommune.region}</p>}
          </div>
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-base font-bold tabular-nums text-foreground ring-1 ring-inset ring-border/50"
            title="Score ud fra dine svar (50-100)"
          >
            {Math.round(score)}
          </span>
        </div>
        {styrker.length > 0 && (
          <div className="mt-4 border-t border-border/70 pt-3">
            <p className="text-xs text-muted">Passer til dig med</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {styrker.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </NextLink>
  );
}
