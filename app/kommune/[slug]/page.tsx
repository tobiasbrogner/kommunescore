import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  IconArrowLeft,
  IconHome,
  IconInfoCircle,
  IconTarget,
  IconTrendingUp,
} from "@tabler/icons-react";
import { KategoriIkon } from "@/components/ikon";
import { RapportVaerktoejer } from "@/components/rapport-vaerktoejer";
import { kommuneSlug } from "@/lib/kommuner/slug";
import {
  hentKommuneRapport,
  slugForKommuneKode,
  type KategoriRapport,
  type KommuneRapport,
  type NoegletalRapport,
} from "@/lib/scores/kommune-rapport";
import type { ProfilPunkt } from "@/lib/scores/profil";
import { officieltKommunenavn } from "@/lib/kommuner/navn";

// Rapport for én kommune. Samme opbygning for alle kommuner: overblik, styrker og
// fokusområder, og derefter hver kategori med dens nøgletal – alt sammenlignet med
// resten af landet.

export async function generateMetadata(props: PageProps<"/kommune/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const rapport = await hentKommuneRapport(slug);
  if (!rapport) return { title: "Kommune ikke fundet" };
  return {
    title: `${rapport.navn} – kommunerapport`,
    description: `Score, placeringer og nøgletal for ${rapport.navn} sammenlignet med resten af Danmark.`,
  };
}

const heltal = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const decimaltal = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

// Store tal (fx indbyggere) uden decimaler, små tal (fx pr. 1.000) med op til to.
function formaterTal(v: number) {
  return Math.abs(v) >= 100 ? heltal.format(v) : decimaltal.format(v);
}

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

function NoegletalRaekke({ n }: { n: NoegletalRapport }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="py-3 pr-4">
        <p className="font-medium text-foreground">{n.navn}</p>
        {n.beskrivelse && <p className="mt-0.5 text-xs leading-snug text-muted">{n.beskrivelse}</p>}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">
        <span className="font-semibold text-foreground">{formaterTal(n.vaerdi)}</span>{" "}
        <span className="text-muted">{n.enhed}</span>
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-muted">
        {formaterTal(n.gennemsnit)} {n.enhed}
      </td>
      <td className="whitespace-nowrap py-3 text-right text-muted">
        <Placering rang={n.rang} antal={n.antal} />
      </td>
    </tr>
  );
}

function KategoriSektion({ k, navn }: { k: KategoriRapport; navn: string }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
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

      {k.noegletal.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
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
            </tbody>
          </table>
        </div>
      )}
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
        className={`mt-4 grid gap-4 ${om.beskrivelse ? "md:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <NextLink
          href="/kort"
          data-skjul-ved-print
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          Til kortet
        </NextLink>
        <RapportVaerktoejer kommunenavn={rapport.navn} slug={kommuneSlug(rapport.navn)} />
      </div>

      {/* Overblik */}
      <header className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-surface-secondary to-accent/10 sm:h-56">
          {rapport.harBillede ? (
            // eslint-disable-next-line @next/next/no-img-element -- samme simple billedvisning som på kortet.
            <img
              src={`/kommuner/${rapport.kode}.jpg`}
              alt={rapport.navn}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <IconHome className="h-10 w-10 text-muted/50" />
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

      <p className="mt-10 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Den samlede score er beregnet med standardvægte for alle kategorier, så dine valg under
        Prioritet på kortet ikke påvirker rapporten. Placeringer og landsgennemsnit gælder alle{" "}
        {rapport.samlet.antal} kommuner.
      </p>
    </main>
  );
}
