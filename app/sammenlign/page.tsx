import type { Metadata } from "next";
import NextLink from "next/link";
import { IconArrowLeft, IconHome, IconInfoCircle } from "@tabler/icons-react";
import { KategoriIkon } from "@/components/ikon";
import { SammenlignVaelger } from "@/components/sammenlign-vaelger";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { getCachedRapportData } from "@/lib/scores/get-scores";
import { hentKommuneRapport, type KommuneRapport } from "@/lib/scores/kommune-rapport";
import { formaterTal } from "@/lib/scores/formater";

// Op til fire kommuner side om side: samlet score, fakta og hver kategori med dens
// nøgletal. Valget står i adressen (/sammenlign?kommuner=aarhus,odense), så en
// sammenligning kan deles. Scorerne er med standardvægte som i kommunerapporten.

const MAKS = 4;

// Med valgte kommuner står de i titlen, fx "Aarhus vs. Odense – sammenlign kommuner".
export async function generateMetadata(props: PageProps<"/sammenlign">): Promise<Metadata> {
  const { kommuner: parameter } = await props.searchParams;
  const data = await getCachedRapportData();
  const navnPrSlug = new Map(data.kommuner.map((k) => [kommuneSlug(k.navn), k.navn]));
  const navne = valgteSlugs(parameter)
    .flatMap((s) => navnPrSlug.get(s) ?? [])
    .slice(0, MAKS);

  const title =
    navne.length >= 2
      ? `${navne.join(" vs. ")} – sammenlign kommuner | Kommuna`
      : "Sammenlign kommuner | Kommuna";
  const description =
    navne.length >= 2
      ? `Sammenlign ${navne.slice(0, -1).join(", ")} og ${navne.at(-1)} side om side: samlet score, boligpriser, skat og alle nøgletal.`
      : "Sammenlign op til fire kommuner side om side – score, fakta og nøgletal.";
  return { title, description, openGraph: { title, description, siteName: "Kommuna", locale: "da_DK" } };
}

const heltal = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

function valgteSlugs(parameter: string | string[] | undefined) {
  const tekst = Array.isArray(parameter) ? parameter.join(",") : (parameter ?? "");
  return [...new Set(tekst.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

// Indeks for de bedste værdier i en række (lige værdier deler). Ingen, når der kun er én
// kommune med en værdi, eller når alle har den samme.
function bedste(vaerdier: (number | null)[], hoejereErBedre: boolean): Set<number> {
  const med = vaerdier.flatMap((v, i) => (v === null ? [] : [{ v, i }]));
  if (med.length < 2) return new Set();
  const top = hoejereErBedre ? Math.max(...med.map((m) => m.v)) : Math.min(...med.map((m) => m.v));
  const vindere = med.filter((m) => m.v === top);
  return vindere.length === med.length ? new Set() : new Set(vindere.map((m) => m.i));
}

function Celle({ bedst, children }: { bedst: boolean; children: React.ReactNode }) {
  return (
    <td
      className={`px-4 py-3 text-right align-top tabular-nums ${
        bedst ? "bg-success/10 font-semibold text-foreground" : "text-foreground"
      }`}
    >
      {children}
    </td>
  );
}

function RaekkeNavn({ navn, beskrivelse }: { navn: string; beskrivelse?: string }) {
  return (
    <th
      scope="row"
      // Lange sammensatte ord (fx "Grundskyldspromille") må deles på mobil, så kolonnen kan
      // være smal og der er plads til kommunerne.
      className="sticky left-0 z-10 min-w-28 bg-surface px-3 py-3 text-left align-top font-normal text-muted hyphens-auto wrap-anywhere sm:px-4 sm:wrap-normal"
    >
      <span className="block text-sm text-foreground">{navn}</span>
      {beskrivelse && <span className="mt-0.5 block text-xs">{beskrivelse}</span>}
    </th>
  );
}

function Tabel({ rapporter }: { rapporter: KommuneRapport[] }) {
  const samletBedst = bedste(rapporter.map((r) => r.samlet.score), true);

  const fakta: { navn: string; vaerdier: (string | null)[] }[] = [
    { navn: "Region", vaerdier: rapporter.map((r) => r.regionNavn) },
    { navn: "Største by", vaerdier: rapporter.map((r) => r.om.stoersteBy) },
    {
      navn: "Indbyggere",
      vaerdier: rapporter.map((r) => (r.om.indbyggere != null ? heltal.format(r.om.indbyggere) : null)),
    },
    {
      navn: "Areal",
      vaerdier: rapporter.map((r) =>
        r.om.arealKm2 != null ? `ca. ${heltal.format(r.om.arealKm2)} km²` : null,
      ),
    },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 w-32 min-w-28 bg-surface px-3 py-4 text-left align-bottom text-xs font-medium text-muted sm:w-56 sm:px-4">
              Kommune
            </th>
            {rapporter.map((r, i) => (
              <th key={r.kode} className="min-w-36 px-4 py-4 text-right align-bottom font-normal">
                <div className="ml-auto flex w-full max-w-56 flex-col items-end gap-3">
                  <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-surface-secondary to-accent/10">
                    {r.harBillede ? (
                      // eslint-disable-next-line @next/next/no-img-element -- samme simple billedvisning som i rapporten.
                      <img
                        src={`/kommuner/${r.kode}.jpg`}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <IconHome className="h-7 w-7 text-muted/50" />
                    )}
                  </div>
                  <div className="flex w-full items-center justify-between gap-3">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold tabular-nums ${
                        samletBedst.has(i) ? "bg-accent text-accent-foreground" : "bg-surface-secondary text-foreground"
                      }`}
                      title={`Samlet score: ${Math.round(r.samlet.score)} ud af 100`}
                    >
                      {Math.round(r.samlet.score)}
                    </span>
                    <div className="min-w-0 text-right">
                      <NextLink
                        href={`/kommune/${kommuneSlug(r.navn)}`}
                        className="block truncate text-base font-semibold text-foreground hover:text-accent"
                      >
                        {r.navn}
                      </NextLink>
                      <span className="whitespace-nowrap text-xs text-muted tabular-nums">
                        Nr. {r.samlet.rang} af {r.samlet.antal}
                      </span>
                    </div>
                  </div>
                </div>
              </th>
            ))}
            <th className="px-4 py-4 text-right align-bottom text-xs font-medium text-muted">
              Landsgennemsnit
            </th>
          </tr>
        </thead>

        <tbody>
          {fakta.map((f) => (
            <tr key={f.navn} className="border-b border-border/60">
              <RaekkeNavn navn={f.navn} />
              {f.vaerdier.map((v, i) => (
                <Celle key={i} bedst={false}>
                  {v ?? <span className="text-muted">–</span>}
                </Celle>
              ))}
              <td className="px-4 py-3" />
            </tr>
          ))}

          {rapporter[0].kategorier.map((k0, ki) => {
            const kategorier = rapporter.map((r) => r.kategorier[ki]);
            const scoreBedst = bedste(kategorier.map((k) => k.score), true);
            // Alle nøgletal i kategorien; en kommune kan mangle et, hvis det ikke er opgjort.
            const noegletal = [
              ...new Map(kategorier.flatMap((k) => k.noegletal).map((n) => [n.id, n])).values(),
            ];

            return [
              // Kommunenavnene gentages ved hver kategori, så man kan se, hvilken kolonne der er
              // hvilken, når man har scrollet forbi toppen.
              <tr key={`k-${k0.kategori.id}`} className="border-b border-border bg-surface-secondary/60">
                <th
                  scope="rowgroup"
                  className="sticky left-0 z-10 min-w-28 bg-surface-secondary px-3 pb-2 pt-5 text-left hyphens-auto wrap-anywhere sm:px-4 sm:wrap-normal"
                >
                  <span className="inline-flex items-start gap-2 text-sm font-semibold text-foreground sm:text-base">
                    <KategoriIkon navn={k0.kategori.ikon} className="mt-0.5 h-4 w-4 shrink-0 text-accent sm:mt-1" />
                    {k0.kategori.navn}
                  </span>
                </th>
                {rapporter.map((r) => (
                  <th
                    key={r.kode}
                    scope="col"
                    className="px-4 pb-2 pt-5 text-right text-xs font-medium text-muted"
                  >
                    {r.navn}
                  </th>
                ))}
                <th scope="col" className="px-4 pb-2 pt-5 text-right text-xs font-medium text-muted">
                  Landsgennemsnit
                </th>
              </tr>,
              <tr key={`s-${k0.kategori.id}`} className="border-b border-border/60">
                <RaekkeNavn navn="Score" beskrivelse="50–100, højere er bedre" />
                {kategorier.map((k, i) => (
                  <Celle key={i} bedst={scoreBedst.has(i)}>
                    <span className="text-base">{Math.round(k.score)}</span>
                    <span className="block whitespace-nowrap text-xs font-normal text-muted">
                      Nr. {k.rang} af {k.antal}
                    </span>
                  </Celle>
                ))}
                <td className="px-4 py-3 text-right align-top tabular-nums text-muted">
                  {Math.round(k0.gennemsnit)}
                </td>
              </tr>,
              ...noegletal.map((n) => {
                const raekke = kategorier.map((k) => k.noegletal.find((x) => x.id === n.id) ?? null);
                const bedst = bedste(
                  raekke.map((x) => x?.vaerdi ?? null),
                  n.retning === "hoejere_bedre",
                );
                return (
                  <tr key={`n-${n.id}`} className="border-b border-border/60">
                    <RaekkeNavn
                      navn={n.navn}
                      beskrivelse={n.retning === "hoejere_bedre" ? "Højere er bedre" : "Lavere er bedre"}
                    />
                    {raekke.map((x, i) => (
                      <Celle key={i} bedst={bedst.has(i)}>
                        {x ? (
                          <>
                            {formaterTal(x.vaerdi)} <span className="font-normal text-muted">{n.enhed}</span>
                            <span className="block whitespace-nowrap text-xs font-normal text-muted">
                              Nr. {x.rang} af {x.antal}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted">–</span>
                        )}
                      </Celle>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3 text-right align-top tabular-nums text-muted">
                      {formaterTal(n.gennemsnit)} {n.enhed}
                    </td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function SammenlignSide(props: PageProps<"/sammenlign">) {
  const { kommuner: parameter } = await props.searchParams;
  const data = await getCachedRapportData();
  const alle = data.kommuner
    .map((k) => ({ navn: k.navn, slug: kommuneSlug(k.navn) }))
    .sort((a, b) => a.navn.localeCompare(b.navn, "da"));

  // Ukendte navne i adressen springes over; højst MAKS kommuner.
  const slugs = valgteSlugs(parameter)
    .filter((s) => alle.some((k) => k.slug === s))
    .slice(0, MAKS);
  const rapporter = (await Promise.all(slugs.map((s) => hentKommuneRapport(s)))).filter(
    (r): r is KommuneRapport => r !== null,
  );
  const valgte = rapporter.map((r) => ({ navn: r.navn, slug: kommuneSlug(r.navn) }));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <NextLink
        href="/kort"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Til kortet
      </NextLink>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Sammenlign kommuner
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Vælg op til {MAKS} kommuner og se dem side om side – samlet score, fakta og alle
          nøgletal. Det bedste tal i hver række er fremhævet.
        </p>
      </header>

      <div className="mt-6">
        <SammenlignVaelger valgte={valgte} alle={alle} maks={MAKS} />
      </div>

      {rapporter.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-medium text-foreground">Ingen kommuner valgt endnu</p>
          <p className="mt-1 text-sm text-muted">
            Skriv et kommunenavn i feltet ovenfor, eller prøv fx{" "}
            <NextLink
              href="/sammenlign?kommuner=aarhus,odense,aalborg"
              className="font-medium text-accent hover:underline"
            >
              Aarhus, Odense og Aalborg
            </NextLink>
            .
          </p>
        </div>
      ) : (
        <>
          {rapporter.length === 1 && (
            <p className="mt-4 text-sm text-muted">Tilføj en kommune mere for at sammenligne.</p>
          )}
          <div className="mt-6">
            <Tabel rapporter={rapporter} />
          </div>
          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Scorerne er beregnet med standardvægte for alle kategorier, ligesom i
            kommunerapporterne, så dine valg under Prioritet på kortet ikke påvirker dem.
            Placeringer og landsgennemsnit gælder alle {rapporter[0].samlet.antal} kommuner.
          </p>
        </>
      )}
    </main>
  );
}
