import type { Metadata } from "next";
import NextLink from "next/link";
import { Card } from "@heroui/react";
import { buttonVariants, linkVariants } from "@heroui/styles";
import {
  IconAdjustmentsHorizontal,
  IconArrowRight,
  IconArrowsLeftRight,
  IconFileAnalytics,
  IconHeart,
  IconMap2,
  IconMessageCircle,
  IconShare,
  IconUserCircle,
} from "@tabler/icons-react";
import { ForsideKort } from "@/components/forside-kort";
import type { ForsideHus } from "@/components/forside-huse";
import { KategoriIkon } from "@/components/ikon";
import { KommuneSoeg } from "@/components/kommune-soeg";
import kommunePunkter from "@/data/kommune-punkter.json";
import { DANMARK_BREDDE, DANMARK_HOEJDE, projekterTilDanmarkskort } from "@/lib/danmarkskort";
import { sammenlignKommunenavne } from "@/lib/kommuner/navn";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { kommunerMedBillede } from "@/lib/kommuner/billeder";
import { REGION_NAVNE } from "@/lib/kommuner/regioner";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";
import { hentGeoFakta } from "@/lib/scores/kommune-rapport";
import { byggKategoriFordelinger, byggKommuneProfil } from "@/lib/scores/profil";
import { PROFILER, profilLink } from "@/lib/scores/profiler";

export const metadata: Metadata = {
  title: "Kommuna – find den kommune, der passer til dit liv",
  description:
    "Vælg hvad der betyder mest for dig, og se hvordan alle 98 kommuner klarer sig. Sammenlign kommuner side om side. Bygget på offentlige tal fra bl.a. Danmarks Statistik.",
  alternates: { canonical: "/" },
};

const link = linkVariants();

// Husene på Danmarkskortet øverst: fem kommuner spredt over landet som eksempler.
const EKSEMPEL_KOMMUNER = ["0851", "0751", "0573", "0461", "0259"]; // Aalborg, Aarhus, Varde, Odense, Køge

// En kort forklaring pr. kategori (efter slug). Nye kategorier uden tekst viser deres
// nøgletal i stedet, så forsiden aldrig mangler noget.
const KATEGORI_TEKST: Record<string, string> = {
  boligpriser: "Hvad det koster at købe hus eller ejerlejlighed pr. m².",
  indbyggertal: "Hvor mange der bor i kommunen, og hvor tæt de bor.",
  kommuneskat: "Kommuneskatten – og grundskylden, hvis du ejer din bolig.",
  spisesteder: "Hvor mange steder der er at spise ude – i alt og pr. indbygger.",
  natur: "Hvor meget natur og grønt der er, også pr. indbygger.",
  idraet: "Foreningslivet og anlæg som haller, baner og svømmehaller.",
  boern: "Hvad dagpleje, vuggestue, børnehave og SFO koster om året.",
  jobmuligheder: "Hvor mange job der er, og hvor mange der er i arbejde.",
  tryghed: "Anmeldte forbrydelser i forhold til antallet af indbyggere.",
  sundhed: "Middellevetiden og afstanden til nærmeste læge.",
  aeldre: "Ventetiden på plejebolig og hjemmehjælpen til ældre.",
  pendling: "Hvor langt folk pendler – eller afstanden til din egen adresse.",
};

const TRIN = [
  {
    Ikon: IconAdjustmentsHorizontal,
    titel: "Vælg hvad der betyder noget",
    tekst:
      "Skru op for det, der er vigtigt for dig, og ned for resten – eller start med en profil som Børnefamilie eller Pensionist.",
  },
  {
    Ikon: IconMap2,
    titel: "Se hvem der passer bedst",
    tekst:
      "Kortet farves efter din personlige score, og listen viser kommunerne i rækkefølge. Måske dukker et sted op, du ikke havde tænkt på.",
  },
  {
    Ikon: IconFileAnalytics,
    titel: "Sammenlign og læs rapporten",
    tekst:
      "Gem dine favoritter, sæt dem side om side, og læs hver kommunes rapport med de rå tal sammenlignet med resten af landet.",
  },
];

const VAERKTOEJER = [
  {
    Ikon: IconArrowsLeftRight,
    titel: "Sammenlign kommuner",
    tekst: "Sæt op til fire kommuner side om side og se, hvor de adskiller sig.",
    href: "/sammenlign",
  },
  {
    Ikon: IconUserCircle,
    titel: "Start med en profil",
    tekst: "Børnefamilie, pensionist, pendler og flere – og finjustér derfra.",
  },
  {
    Ikon: IconHeart,
    titel: "Gem favoritter",
    tekst: "Saml de kommuner, du overvejer, og send listen til dem, du skal flytte med.",
  },
  {
    Ikon: IconShare,
    titel: "Del din prioritering",
    tekst: "Send et link, så andre ser præcis den samme rangering som dig.",
  },
  {
    Ikon: IconFileAnalytics,
    titel: "En rapport for hver kommune",
    tekst: "Styrker, fokusområder og alle tallene – også som PDF.",
  },
  {
    Ikon: IconMessageCircle,
    titel: "Spørg hjælperen",
    tekst: "Stil spørgsmål til tallene i almindeligt sprog, fx hvorfor en kommune scorer højt.",
  },
];

export default async function Home() {
  const [{ kategorier, kommuner }, geo] = await Promise.all([getCachedKommuneScores(), hentGeoFakta()]);

  const alleKommuner = kommuner
    .map((k) => ({ navn: k.navn, slug: kommuneSlug(k.navn) }))
    .sort((a, b) => sammenlignKommunenavne(a.navn, b.navn));

  // Placering og styrker med standardvægte, som i rapporterne (lige scorer deler placering).
  const punkter = kommunePunkter as Record<string, { lat: number; lon: number }>;
  const fordelinger = byggKategoriFordelinger(kategorier, kommuner);
  const medBillede = new Set(kommunerMedBillede());
  const huse: ForsideHus[] = EKSEMPEL_KOMMUNER.flatMap((kode) => {
    const kommune = kommuner.find((k) => k.kode === kode);
    const punkt = punkter[kode];
    if (!kommune || !punkt) return [];
    const [x, y] = projekterTilDanmarkskort(punkt.lon, punkt.lat);
    const regionskode = geo.get(kode)?.regionskode;
    const profil = byggKommuneProfil(kategorier, fordelinger, kommune.kategorier);
    return [
      {
        kode,
        navn: kommune.navn,
        region: regionskode ? (REGION_NAVNE[regionskode] ?? null) : null,
        harBillede: medBillede.has(kode),
        styrker: profil.styrker.slice(0, 2).map((p) => ({
          navn: p.kategori.navn,
          ikon: p.kategori.ikon,
          tekst: p.tekst,
        })),
        slug: kommuneSlug(kommune.navn),
        score: Math.round(kommune.samlet),
        rang: 1 + kommuner.filter((k) => k.samlet > kommune.samlet).length,
        antal: kommuner.length,
        x: (x / DANMARK_BREDDE) * 100,
        y: (y / DANMARK_HOEJDE) * 100,
      },
    ];
  });

  return (
    <main className="overflow-hidden">
      {/* HERO */}
      <section id="start" className="relative">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div className="motion-rise">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-foreground sm:text-6xl lg:text-7xl">
                Find den kommune,
                <br />
                der passer til
                <br />
                <span className="text-accent">dit liv.</span>
              </h1>

              <ul className="mt-7 flex flex-col gap-1.5 text-lg leading-8 text-muted sm:text-xl">
                <li>
                  Alle {kommuner.length} kommuner i {kategorier.length} kategorier
                </li>
                <li>Bygget på offentlige tal fra bl.a. Danmarks Statistik</li>
                <li>Vægtet efter det, der betyder mest for dig</li>
              </ul>

              <div className="mt-9">
                <NextLink
                  href="/kort"
                  className={buttonVariants({ variant: "primary", size: "lg" })}
                >
                  Find din kommune
                  <IconArrowRight className="h-5 w-5" />
                </NextLink>
                <p className="mt-3 text-sm text-muted">
                  Gratis og uden login. Det tager under et minut.
                </p>
              </div>

              {/* Hver profil åbner kortet med dens vægte (samme linkformat som "Del"). */}
              <div className="mt-8">
                <p className="text-sm font-medium text-foreground">Eller start som</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {PROFILER.map((profil) => (
                    <li key={profil.id}>
                      <NextLink
                        href={profilLink(profil)}
                        title={profil.beskrivelse}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-sm text-foreground transition-colors hover:border-accent/60 hover:bg-accent/5"
                      >
                        <profil.ikon className="h-4 w-4 text-accent" aria-hidden="true" />
                        {profil.navn}
                      </NextLink>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="motion-rise motion-delay-1">
              <ForsideKort huse={huse} />
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
              Fra 98 muligheder til dine favoritter.
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted">
              At vælge hvor man skal bo handler om mange ting på én gang. Vi samler tallene ét
              sted, så du kan se, hvilke kommuner der passer til netop dine behov.
            </p>
          </div>

          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {TRIN.map(({ Ikon, titel, tekst }, i) => (
              <li key={titel}>
                <Card className="h-full border border-border/80 bg-background">
                  <Card.Content className="p-6 sm:p-7">
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <Ikon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-medium tabular-nums text-muted" aria-hidden="true">
                        0{i + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-xl font-semibold">{titel}</h3>
                    <p className="mt-2 leading-7 text-muted">{tekst}</p>
                  </Card.Content>
                </Card>
              </li>
            ))}
          </ol>

          <NextLink
            href="/saadan-virker-det"
            className={`${link.base()} mt-8 inline-flex items-center gap-1.5`}
          >
            Sådan regnes scoren ud
            <IconArrowRight className="h-4 w-4" />
          </NextLink>
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
                Hver kategori bygger på et eller flere nøgletal fra offentlige statistikker. Du
                kan se præcis hvilke, og hvor de kommer fra.
              </p>
              <NextLink
                href="/kilder"
                className={`${link.base()} mt-6 inline-flex items-center gap-1.5`}
              >
                Se alle tal og kilder
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
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {KATEGORI_TEKST[k.slug] ?? k.noegletal.map((n) => n.navn).join(" · ")}
                    </p>
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

          <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {VAERKTOEJER.map(({ Ikon, titel, tekst, href }) => (
              <li key={titel} className="flex gap-4">
                <Ikon className="mt-1 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <h3 className="text-lg font-semibold">
                    {href ? (
                      <NextLink href={href} className="hover:text-accent">
                        {titel}
                      </NextLink>
                    ) : (
                      titel
                    )}
                  </h3>
                  <p className="mt-1 leading-7 text-muted">{tekst}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ALLE KOMMUNER */}
      <section id="alle-kommuner">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-sm font-medium tracking-wide text-accent">Alle kommuner</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                Kender du allerede en kommune?
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted">
                Slå den op og se dens rapport med score, styrker og alle tallene.
              </p>
              <div className="mt-6">
                <KommuneSoeg kommunenavne={alleKommuner.map((k) => k.navn)} />
              </div>
            </div>

            <nav aria-label="Alle kommuner">
              <ul className="columns-2 gap-x-6 text-sm sm:columns-3 lg:columns-4">
                {alleKommuner.map((k) => (
                  <li key={k.slug} className="break-inside-avoid">
                    <NextLink
                      href={`/kommune/${k.slug}`}
                      className="block py-1 text-muted transition-colors hover:text-accent"
                    >
                      {k.navn}
                    </NextLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="kom-i-gang" className="pb-20 sm:pb-24 lg:pb-28">
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
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <NextLink
                    href="/kort"
                    className={buttonVariants({ variant: "primary", size: "lg" })}
                  >
                    Find din kommune
                    <IconArrowRight className="h-5 w-5" />
                  </NextLink>
                  <NextLink href="/sammenlign" className={link.base()}>
                    Sammenlign kommuner
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
