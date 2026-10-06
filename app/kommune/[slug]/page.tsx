import type { Metadata } from "next";
import Image from "next/image";
import NextLink from "next/link";
import { buttonVariants } from "@heroui/styles";
import { notFound, permanentRedirect } from "next/navigation";
import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconArrowsLeftRight,
  IconHome,
  IconInfoCircle,
  IconMap,
  IconTarget,
  IconTrendingUp,
} from "@tabler/icons-react";
import { BilledKreditTekst } from "@/components/billed-kredit";
import { KategoriIkon } from "@/components/ikon";
import { Broedkrummer } from "@/components/json-ld";
import { KommuneFlise, type KommuneFliseData } from "@/components/kommune-flise";
import { billedKredit } from "@/lib/kommuner/billeder";
import { byggKommuneFliser } from "@/lib/kommuner/fliser";
import { RapportVaerktoejer } from "@/components/rapport-vaerktoejer";
import { kommuneSlug } from "@/lib/kommuner/slug";
import {
  hentKommuneRapport,
  slugForKommuneKode,
  type KategoriRapport,
  type KommuneRapport,
  type NoegletalRapport,
} from "@/lib/scores/kommune-rapport";
import { formaterTal } from "@/lib/scores/formater";
import { getCachedKommuneScores, type NoegletalMeta } from "@/lib/scores/get-scores";
import { lignendeKommuner } from "@/lib/scores/lignende";
import type { ProfilPunkt } from "@/lib/scores/profil";
import { officieltKommunenavn } from "@/lib/kommuner/navn";

// Rapport for én kommune. Samme opbygning for alle kommuner: overblik, styrker og
// fokusområder, og derefter hver kategori med dens nøgletal – alt sammenlignet med
// resten af landet.

export async function generateMetadata(props: PageProps<"/kommune/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const rapport = await hentKommuneRapport(slug);
  if (!rapport) return { title: "Kommune ikke fundet" };
  // Titlen er det, folk søger på ("Aarhus Kommune boligpriser"); beskrivelsen bruger
  // kommunens egne tal, så søgeresultatet og delingen siger noget konkret.
  const officielt = officieltKommunenavn(rapport.navn);
  const title = `${officielt}: score, boligpriser og skat | Kommuna`;
  const description =
    `${officielt} får en samlet score på ${Math.round(rapport.samlet.score)} og er nr. ` +
    `${rapport.samlet.rang} af ${rapport.samlet.antal} kommuner. Se boligpriser, kommuneskat, ` +
    `tryghed, børnepasning og ${rapport.kategorier.length - 4} andre kategorier sammenlignet ` +
    `med resten af Danmark.`;
  return {
    title,
    description,
    alternates: { canonical: `/kommune/${slug}` },
    openGraph: { title, description, type: "article", siteName: "Kommuna", locale: "da_DK" },
  };
}

const heltal = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

function Placering({ rang, antal }: { rang: number; antal: number }) {
  return (
    <span className="tabular-nums">
      Nr. <span className="font-semibold text-foreground">{rang}</span> af {antal}
    </span>
  );
}

const BJAELKE_HOEJDE = 8;
const STREG_UDSTIK = 4; // stregen stikker lige meget ud over og under bjælken
const ETIKET_AFSTAND = 3; // luft mellem stregens top og etiketten
const ETIKET_RAEKKE = 14; // ekstra højde, hvis en etiket må løftes en række op

// Hvor etiketten sidder i forhold til stregen: centreret, til venstre for (ender ved
// stregen) eller til højre for (starter ved stregen).
type Forankring = "midt" | "venstre" | "hoejre";
const FORSKYDNING: Record<Forankring, string> = {
  midt: "-50%",
  venstre: "-100%",
  hoejre: "0%",
};

// En lodret streg på bjælken med en lille etiket over. Alle streger har samme
// højde; kun etiketten kan flyttes, så de ikke overlapper.
function Markering({
  procent,
  etiket,
  forankring,
  raekke = 0,
  tekstKlasse,
}: {
  procent: number;
  etiket: string;
  forankring: Forankring;
  raekke?: number;
  tekstKlasse: string;
}) {
  return (
    <>
      <div
        className="absolute w-0.5 -translate-x-1/2 rounded-full bg-foreground/50"
        style={{
          left: `${procent}%`,
          bottom: -STREG_UDSTIK,
          height: BJAELKE_HOEJDE + 2 * STREG_UDSTIK,
        }}
      />
      <span
        className={`absolute overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-none ${tekstKlasse}`}
        style={{
          left: `${procent}%`,
          bottom: BJAELKE_HOEJDE + STREG_UDSTIK + ETIKET_AFSTAND + raekke * ETIKET_RAEKKE,
          transform: `translateX(${FORSKYDNING[forankring]})`,
          // Aldrig bredere end pladsen ud til bjælkens kant (lange navne på smalle skærme).
          maxWidth:
            forankring === "hoejre"
              ? `${100 - procent}%`
              : forankring === "venstre"
                ? `${procent}%`
                : `${2 * Math.min(procent, 100 - procent)}%`,
        }}
      >
        {etiket}
      </span>
    </>
  );
}

// Forankring ved en kant, så etiketten ikke skæres af.
function kantForankring(procent: number): Forankring {
  return procent < 10 ? "hoejre" : procent > 90 ? "venstre" : "midt";
}

// Score på skalaen 50-100 med markering af kommunen og landsgennemsnittet.
function ScoreBjaelke({
  score,
  gennemsnit,
  navn,
}: {
  score: number;
  gennemsnit: number;
  navn: string;
}) {
  const procent = (v: number) => Math.min(100, Math.max(0, ((v - 50) / 50) * 100));
  const pKommune = procent(score);
  const pGennemsnit = procent(gennemsnit);

  // Ligger markeringerne tæt, sættes etiketterne side om side: den venstre ender ved
  // sin streg, og den højre starter ved sin. Er der ikke plads til det ved en kant,
  // løftes kommunens etiket en række op i stedet (stregerne er altid lige høje).
  const taet = Math.abs(pKommune - pGennemsnit) < 22;
  const kommuneTilHoejre = pKommune >= pGennemsnit;
  let forankringKommune = kantForankring(pKommune);
  let forankringGennemsnit = kantForankring(pGennemsnit);
  let raekkeKommune = 0;
  if (taet) {
    const venstre = Math.min(pKommune, pGennemsnit);
    const hoejre = Math.max(pKommune, pGennemsnit);
    if (hoejre <= 85 && venstre >= 15) {
      forankringKommune = kommuneTilHoejre ? "hoejre" : "venstre";
      forankringGennemsnit = kommuneTilHoejre ? "venstre" : "hoejre";
    } else {
      raekkeKommune = 1;
    }
  }
  const toppadding =
    BJAELKE_HOEJDE + STREG_UDSTIK + ETIKET_AFSTAND + (raekkeKommune + 1) * ETIKET_RAEKKE;

  return (
    <div
      className="relative"
      style={{ paddingTop: toppadding }}
      role="img"
      aria-label={`${navn}: ${Math.round(score)}. Landsgennemsnit: ${Math.round(gennemsnit)}. Skala fra 50 til 100.`}
    >
      <div className="relative rounded-full bg-surface-secondary" style={{ height: BJAELKE_HOEJDE }}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pKommune}%` }} />
        <Markering
          procent={pGennemsnit}
          etiket="Landsgennemsnit"
          forankring={forankringGennemsnit}
          tekstKlasse="text-muted"
        />
        <Markering
          procent={pKommune}
          etiket={navn}
          forankring={forankringKommune}
          raekke={raekkeKommune}
          tekstKlasse="text-accent"
        />
      </div>
    </div>
  );
}

function ProfilListe({
  titel,
  Ikon,
  farve,
  punkter,
}: {
  titel: string;
  Ikon: typeof IconTarget;
  farve: string;
  punkter: ProfilPunkt[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className={`flex items-center gap-2 text-base font-semibold ${farve}`}>
        <Ikon className="h-5 w-5" />
        {titel}
      </h3>
      {punkter.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {punkter.map((p) => (
            <li key={p.kategori.id} className="flex items-start gap-3">
              <KategoriIkon navn={p.kategori.ikon} className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
              <div>
                <p className="font-medium text-foreground">{p.kategori.navn}</p>
                <p className="text-sm text-muted">{p.tekst}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">–</p>
      )}
    </div>
  );
}

// Tilvalg tæller ikke i scoren fra start, men kan slås til under Prioritet på kortet.
function Tilvalg({ n }: { n: NoegletalMeta }) {
  if (n.standardValgt) return null;
  return (
    <p className="mt-0.5 text-xs font-medium leading-snug text-muted">
      Tilvalg: tæller ikke med i scoren, men kan slås til under Prioritet på kortet.
    </p>
  );
}

function NoegletalRaekke({ n }: { n: NoegletalRapport }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="py-3 pr-4">
        <p className="font-medium text-foreground">{n.navn}</p>
        <Tilvalg n={n} />
        {n.beskrivelse && <p className="mt-0.5 text-xs leading-snug text-muted">{n.beskrivelse}</p>}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">
        <span className="font-semibold text-foreground">{formaterTal(n.vaerdi, n.decimaler)}</span>{" "}
        <span className="text-muted">{n.enhed}</span>
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-muted">
        {formaterTal(n.gennemsnit, n.decimaler)} {n.enhed}
      </td>
      <td className="whitespace-nowrap py-3 text-right text-muted">
        <Placering rang={n.rang} antal={n.antal} />
      </td>
    </tr>
  );
}

// Et nøgletal, der ikke er opgjort for kommunen, fx lejlighedspriser i små kommuner med få
// salg. Vises i stedet for bare at mangle, så man kan se, hvad scoren (ikke) bygger på.
function IkkeOpgjort({ n, navn }: { n: NoegletalMeta; navn: string }) {
  return (
    <>
      <p className="font-medium text-foreground">{n.navn}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted">
        Ikke opgjort for {navn}, så det tæller ikke med i kategoriens score.
      </p>
    </>
  );
}

// Nøgletallene på mobil: navn og tal øverst, sammenligningen under og beskrivelsen til sidst,
// så intet skal klemmes ind i smalle kolonner.
function NoegletalKort({ n }: { n: NoegletalRapport }) {
  return (
    <li className="border-t border-border py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-foreground">{n.navn}</p>
        <p className="shrink-0 whitespace-nowrap tabular-nums">
          <span className="font-semibold text-foreground">{formaterTal(n.vaerdi, n.decimaler)}</span>{" "}
          <span className="text-muted">{n.enhed}</span>
        </p>
      </div>
      <p className="mt-0.5 text-xs text-muted tabular-nums">
        Landsgennemsnit {formaterTal(n.gennemsnit, n.decimaler)} {n.enhed} ·{" "}
        <Placering rang={n.rang} antal={n.antal} />
      </p>
      <Tilvalg n={n} />
      {n.beskrivelse && <p className="mt-1.5 text-xs leading-snug text-muted">{n.beskrivelse}</p>}
    </li>
  );
}

function KategoriSektion({ k, navn }: { k: KategoriRapport; navn: string }) {
  const harNoegletal = k.noegletal.length + k.manglendeNoegletal.length > 0;
  return (
    <section
      id={k.kategori.slug}
      className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <KategoriIkon navn={k.kategori.ikon} className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{k.kategori.navn}</h3>
            <p className="text-sm text-muted">
              <Placering rang={k.rang} antal={k.antal} /> · Landsgennemsnit{" "}
              <span className="tabular-nums">{Math.round(k.gennemsnit)}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums text-foreground">{Math.round(k.score)}</p>
          <p className="text-xs text-muted">score</p>
        </div>
      </div>

      <div className="mt-4">
        <ScoreBjaelke score={k.score} gennemsnit={k.gennemsnit} navn={navn} />
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {harNoegletal && (
        <>
          {/* Mobil: nøgletallene stablet. */}
          <ul className="mt-4 text-sm sm:hidden">
            {k.noegletal.map((n) => (
              <NoegletalKort key={n.id} n={n} />
            ))}
            {k.manglendeNoegletal.map((n) => (
              <li key={n.id} className="border-t border-border py-3">
                <IkkeOpgjort n={n} navn={navn} />
              </li>
            ))}
          </ul>

          {/* Større skærme: tabel. */}
          <table className="mt-4 hidden w-full text-sm sm:table">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 pr-4 font-medium">Nøgletal</th>
                <th className="pb-2 pr-4 text-right font-medium">Kommunen</th>
                <th className="pb-2 pr-4 text-right font-medium">Landsgennemsnit</th>
                <th className="pb-2 text-right font-medium">Placering</th>
              </tr>
            </thead>
            <tbody>
              {k.noegletal.map((n) => (
                <NoegletalRaekke key={n.id} n={n} />
              ))}
              {k.manglendeNoegletal.map((n) => (
                <tr key={n.id} className="border-t border-border align-top">
                  <td className="py-3 pr-4">
                    <IkkeOpgjort n={n} navn={navn} />
                  </td>
                  <td className="py-3 pr-4 text-right text-muted">–</td>
                  <td className="py-3 pr-4 text-right text-muted">–</td>
                  <td className="py-3 text-right text-muted">–</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

// Alle kategorier i ét blik øverst i rapporten, med link ned til hver kategoris tal.
function KategoriOverblik({ kategorier }: { kategorier: KategoriRapport[] }) {
  const procent = (v: number) => Math.min(100, Math.max(0, ((v - 50) / 50) * 100));
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-foreground">Kategorierne i overblik</h2>
      <p className="mt-1 text-sm text-muted">
        Scoren fra 50 til 100 i hver kategori. Stregen viser landsgennemsnittet. Vælg en
        kategori for at se tallene bag.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        {kategorier.map((k) => (
          <li key={k.kategori.id}>
            <a
              href={`#${k.kategori.slug}`}
              className="flex h-full flex-col gap-2.5 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent/60 sm:p-3.5"
            >
              {/* På mobil står scoren nederst, så navnet får hele bredden. */}
              <div className="flex items-center gap-2.5">
                <KategoriIkon navn={k.kategori.ikon} className="h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 text-sm font-medium leading-tight text-foreground">
                  {k.kategori.navn}
                </span>
                <span className="hidden text-lg font-semibold tabular-nums text-foreground sm:inline">
                  {Math.round(k.score)}
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-surface-secondary" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${procent(k.score)}%` }} />
                <div
                  className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/50"
                  style={{ left: `${procent(k.gennemsnit)}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted">
                  <Placering rang={k.rang} antal={k.antal} />
                </span>
                <span className="text-lg font-semibold tabular-nums text-foreground sm:hidden">
                  {Math.round(k.score)}
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Kommuner med de mest ens scorer og en lignende størrelse (se lib/scores/lignende.ts),
// så man opdager steder, man ikke havde tænkt på. Vises ikke i udskriften og PDF'en.
function LignendeKommuner({ navn, kommuner }: { navn: string; kommuner: KommuneFliseData[] }) {
  if (kommuner.length === 0) return null;
  return (
    <section data-skjul-ved-print className="mt-10">
      <h2 className="text-xl font-semibold text-foreground">Kommuner, der ligner {navn}</h2>
      <p className="mt-1 text-sm text-muted">
        De har de mest ens scorer i kategorierne og omtrent samme størrelse og
        befolkningstæthed.
      </p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kommuner.map((k) => (
          <li key={k.kode}>
            <KommuneFlise kommune={k} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// Afslutningen: hvor man kan gå hen, når man har læst rapporten.
function VidereFra({ navn, slug }: { navn: string; slug: string }) {
  return (
    <section data-skjul-ved-print className="mt-10 rounded-2xl border border-border bg-surface-secondary p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-foreground">Gå videre med {navn}</h2>
      <p className="mt-1 text-sm text-muted">
        Se kommunen på kortet, sammenlign den med andre, eller sæt dine egne prioriteter og se,
        hvor den lander for dig.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <NextLink
          href={`/kort?kommune=${slug}`}
          className={buttonVariants({ variant: "primary" })}
        >
          <IconMap className="h-4 w-4" />
          Se {navn} på kortet
        </NextLink>
        <NextLink
          href={`/sammenlign?kommuner=${slug}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <IconArrowsLeftRight className="h-4 w-4" />
          Sammenlign med andre kommuner
        </NextLink>
        <NextLink
          href="/kort"
          className="inline-flex items-center gap-1.5 px-2 text-sm font-medium text-accent hover:underline"
        >
          <IconAdjustmentsHorizontal className="h-4 w-4" />
          Lav din egen rangering
        </NextLink>
      </div>
    </section>
  );
}

// Kort beskrivelse (redigeres i admin-panelet) og fakta, der beregnes ud fra data.
function OmKommunen({ rapport }: { rapport: KommuneRapport }) {
  const { om } = rapport;
  const fakta = [
    { etiket: "Region", vaerdi: rapport.regionNavn },
    { etiket: "Største by", vaerdi: om.stoersteBy },
    { etiket: "Indbyggere", vaerdi: om.indbyggere != null ? heltal.format(om.indbyggere) : null },
    {
      etiket: "Areal",
      vaerdi: om.arealKm2 != null ? `ca. ${heltal.format(om.arealKm2)} km²` : null,
    },
    {
      etiket: "Indbyggere pr. km²",
      vaerdi:
        om.indbyggere != null && om.arealKm2
          ? `ca. ${heltal.format(om.indbyggere / om.arealKm2)}`
          : null,
    },
  ].filter((f): f is { etiket: string; vaerdi: string } => f.vaerdi != null);

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-foreground">
        Om {officieltKommunenavn(rapport.navn)}
      </h2>
      <div
        className={`mt-4 grid items-start gap-4 ${om.beskrivelse ? "md:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
      >
        {om.beskrivelse && (
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <p className="whitespace-pre-line leading-relaxed text-foreground">{om.beskrivelse}</p>
          </div>
        )}
        <dl className="grid content-start gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 md:grid-cols-1">
          {fakta.map((f) => (
            <div key={f.etiket}>
              <dt className="text-xs text-muted">{f.etiket}</dt>
              <dd className="font-medium tabular-nums text-foreground">{f.vaerdi}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export default async function KommuneRapportSide(props: PageProps<"/kommune/[slug]">) {
  const { slug } = await props.params;

  // Gamle adresser med kommunekode (fx /kommune/0751) sendes videre til navnet (/kommune/aarhus).
  if (/^\d{4}$/.test(slug)) {
    const nyAdresse = await slugForKommuneKode(slug);
    if (nyAdresse) permanentRedirect(`/kommune/${nyAdresse}`);
  }

  const rapport = await hentKommuneRapport(slug);
  if (!rapport) notFound();
  const kredit = billedKredit(rapport.kode);

  // Placeringen på kortene regnes blandt alle kommuner, så de fire beholder deres rigtige nr.
  const { kategorier, kommuner } = await getCachedKommuneScores();
  const lignendeKoder = lignendeKommuner(rapport.kode, kommuner, kategorier).map((k) => k.kode);
  const fliser = await byggKommuneFliser(kommuner);
  const lignende = lignendeKoder.flatMap((kode) => fliser.filter((f) => f.kode === kode));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Broedkrummer
        sti={[
          ["Kommuner", "/kommuner"],
          [officieltKommunenavn(rapport.navn), `/kommune/${kommuneSlug(rapport.navn)}`],
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <NextLink
          href={`/kort?kommune=${kommuneSlug(rapport.navn)}`}
          data-skjul-ved-print
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          Til kortet
        </NextLink>
        <div className="flex flex-wrap items-center gap-2" data-skjul-ved-print>
          <NextLink
            href={`/sammenlign?kommuner=${kommuneSlug(rapport.navn)}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary"
          >
            <IconArrowsLeftRight className="h-4 w-4" />
            Sammenlign
          </NextLink>
          <RapportVaerktoejer kommunenavn={rapport.navn} slug={kommuneSlug(rapport.navn)} />
        </div>
      </div>

      {/* Overblik */}
      <header className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-surface-secondary to-accent/10 sm:h-56">
          {rapport.harBillede ? (
            // Optimeret af Next.js (mindre fil i den bredde, siden viser), og hentet med det
            // samme, da det er det første, man ser.
            <Image
              src={`/kommuner/${rapport.kode}.jpg`}
              alt={rapport.navn}
              fill
              priority
              sizes="(min-width: 1024px) 960px, 100vw"
              className="object-cover"
            />
          ) : (
            <IconHome className="h-10 w-10 text-muted/50" />
          )}
          {rapport.harBillede && kredit && (
            <p className="absolute right-2 bottom-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur-sm print:hidden">
              <BilledKreditTekst kredit={kredit} />
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
          <div>
            <p className="text-sm font-medium text-accent">Kommunerapport</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {rapport.navn}
            </h1>
            {rapport.regionNavn && <p className="mt-1 text-muted">{rapport.regionNavn}</p>}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm text-muted">
              <p>
                <Placering rang={rapport.samlet.rang} antal={rapport.samlet.antal} />
              </p>
              <p>
                Landsgennemsnit{" "}
                <span className="tabular-nums">{Math.round(rapport.samlet.gennemsnit)}</span>
              </p>
            </div>
            <div
              className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-accent text-accent-foreground"
              title={`Samlet score: ${Math.round(rapport.samlet.score)} ud af 100`}
            >
              <span className="text-2xl font-bold tabular-nums">{Math.round(rapport.samlet.score)}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">Samlet</span>
            </div>
          </div>
        </div>
      </header>

      <KategoriOverblik kategorier={rapport.kategorier} />

      <OmKommunen rapport={rapport} />

      {/* Styrker og fokusområder */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Styrker og fokusområder</h2>
        <p className="mt-1 text-sm text-muted">
          Hvor kommunen klarer sig bedst og mindst godt, sammenlignet med resten af landet.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ProfilListe
            titel="Styrker"
            Ikon={IconTrendingUp}
            farve="text-success"
            punkter={rapport.profil.styrker}
          />
          <ProfilListe
            titel="Fokusområder"
            Ikon={IconTarget}
            farve="text-accent"
            punkter={rapport.profil.fokus}
          />
        </div>
      </section>

      {/* Kategorier og nøgletal */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Kategorier og nøgletal</h2>
        <p className="mt-1 text-sm text-muted">
          Scoren i hver kategori går fra 50 til 100 og sammenlignes med landsgennemsnittet.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {rapport.kategorier.map((k) => (
            <KategoriSektion key={k.kategori.id} k={k} navn={rapport.navn} />
          ))}
        </div>
      </section>

      <LignendeKommuner navn={rapport.navn} kommuner={lignende} />

      <VidereFra navn={rapport.navn} slug={kommuneSlug(rapport.navn)} />

      <p className="mt-10 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Den samlede score er beregnet med standardvægte for alle kategorier, så dine valg under
        Prioritet på kortet ikke påvirker rapporten. Placeringer og landsgennemsnit gælder alle{" "}
        {rapport.samlet.antal} kommuner.
      </p>
    </main>
  );
}
