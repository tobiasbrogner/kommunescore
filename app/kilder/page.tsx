import type { Metadata } from "next";
import NextLink from "next/link";
import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";
import { BilledKreditTekst } from "@/components/billed-kredit";
import { KategoriIkon } from "@/components/ikon";
import { dstTabeller, statistikbankenUrl } from "@/lib/kilder";
import { DATA_OPDATERET } from "@/lib/om-kommuna";
import { alleBilledKreditter } from "@/lib/kommuner/billeder";
import { sammenlignKommunenavne } from "@/lib/kommuner/navn";
import { getCachedRapportData } from "@/lib/scores/get-scores";
import { UDJAEVNEDE_NOEGLETAL, UDJAEVNING_INDBYGGERE } from "@/lib/scores/udjaevning";

export const metadata: Metadata = {
  title: "Kilder | Kommuna",
  description: "Hvor tallene på Kommuna kommer fra.",
};

// Siden bygges ud fra kategorierne og nøgletallene i databasen, så en ny kategori
// automatisk kommer med. Hver kategori har et anker (#slug), som tooltips på /kort
// linker til.
export default async function KilderSide() {
  const { kategorier, noegletal, kommuner } = await getCachedRapportData();

  // Krediteringen af kommunefotos, sorteret efter kommunenavn.
  const kommunenavn = new Map(kommuner.map((k) => [k.kode, k.navn]));
  const fotos = alleBilledKreditter()
    .map(([kode, kredit]) => [kode, kommunenavn.get(kode) ?? kode, kredit] as const)
    .sort(([, a], [, b]) => sammenlignKommunenavne(a, b));

  const noegletalPrKategori = new Map(
    kategorier.map((k) => [k.id, noegletal.filter((n) => n.kategoriId === k.id)]),
  );

  // Alle Statistikbank-tabeller og hvilke kategorier, der bruger dem.
  const tabeller = new Map<string, Set<string>>();
  for (const kat of kategorier) {
    for (const n of noegletalPrKategori.get(kat.id) ?? []) {
      for (const tabel of dstTabeller(n.beskrivelse)) {
        if (!tabeller.has(tabel)) tabeller.set(tabel, new Set());
        tabeller.get(tabel)!.add(kat.navn);
      }
    }
  }
  const sorteredeTabeller = [...tabeller].sort(([a], [b]) => a.localeCompare(b, "da"));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <NextLink
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Til forsiden
      </NextLink>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Kilder</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Her kan du se, hvilke tal hver kategori bygger på, og hvor de kommer fra. Tallene er
          senest opdateret i {DATA_OPDATERET}.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Kategorier</h2>
        <div className="mt-4 flex flex-col gap-4">
          {kategorier.map((kat) => {
            const katNoegletal = noegletalPrKategori.get(kat.id) ?? [];
            return (
              <article
                key={kat.id}
                id={kat.slug}
                className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6"
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <KategoriIkon navn={kat.ikon} className="h-5 w-5 shrink-0 text-muted" />
                  {kat.navn}
                </h3>
                {katNoegletal.length > 0 ? (
                  <dl className="mt-3 flex flex-col divide-y divide-border">
                    {katNoegletal.map((n) => {
                      const kilder = dstTabeller(n.beskrivelse);
                      return (
                        <div key={n.id} className="py-3 first:pt-0 last:pb-0">
                          <dt className="font-medium text-foreground">{n.navn}</dt>
                          {n.beskrivelse && (
                            <dd className="mt-1 text-sm leading-relaxed text-muted">{n.beskrivelse}</dd>
                          )}
                          {UDJAEVNEDE_NOEGLETAL.has(n.navn) && (
                            <dd className="mt-1 text-sm leading-relaxed text-muted">
                              Små kommuners tal{" "}
                              <a href="#smaa-kommuner" className="font-medium text-accent hover:underline">
                                udjævnes
                              </a>{" "}
                              mod landsniveauet, før de får en score.
                            </dd>
                          )}
                          {kilder.length > 0 && (
                            <dd className="mt-2 flex flex-wrap gap-1.5">
                              {kilder.map((tabel) => (
                                <TabelLink key={tabel} tabel={tabel} />
                              ))}
                            </dd>
                          )}
                        </div>
                      );
                    })}
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-muted">Ingen nøgletal endnu.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section id="smaa-kommuner" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold text-foreground">Små kommuner</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Tal pr. indbygger, som fx indbrud eller idrætsanlæg, bygger på få hændelser i en lille
          kommune, så tilfældigheder slår hårdt igennem: ét indbrud mere eller mindre kan flytte
          Læsø fra top til bund. Derfor trækkes de mod landsniveauet, jo færre indbyggere
          kommunen har, før de får en score. Kommunen vægtes som sit indbyggertal og
          landsniveauet som {UDJAEVNING_INDBYGGERE.toLocaleString("da-DK")} indbyggere, så Læsø
          (ca. 1.800 indbyggere) beholder godt en fjerdedel af sit eget tal, mens kommuner med
          50.000 indbyggere beholder ca. 90 %. Rapporterne viser altid de rigtige tal.
        </p>
      </section>

      {sorteredeTabeller.length > 0 && (
        <section id="tabeller" className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-semibold text-foreground">Alle tabeller</h2>
          <p className="mt-1 text-sm text-muted">
            Tabellerne kommer fra Danmarks Statistiks Statistikbank, hvor du selv kan hente de
            nyeste tal.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">Tabel</th>
                  <th className="px-5 py-3 font-medium">Bruges i</th>
                </tr>
              </thead>
              <tbody>
                {sorteredeTabeller.map(([tabel, brugtI]) => (
                  <tr key={tabel} className="border-t border-border">
                    <td className="px-5 py-3">
                      <TabelLink tabel={tabel} />
                    </td>
                    <td className="px-5 py-3 text-muted">{[...brugtI].join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {fotos.length > 0 && (
        <section id="fotos" className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-semibold text-foreground">Fotos</h2>
          <p className="mt-1 text-sm text-muted">
            Kommunernes fotos kommer fra Wikimedia Commons og er beskåret til siden. Klik på
            fotografen for at se det oprindelige billede.
          </p>
          <ul className="mt-4 grid gap-x-6 gap-y-1.5 rounded-2xl border border-border bg-surface p-5 text-sm sm:grid-cols-2 sm:p-6">
            {fotos.map(([kode, navn, kredit]) => (
              <li key={kode} className="text-muted">
                <span className="font-medium text-foreground">{navn}:</span>{" "}
                <BilledKreditTekst kredit={kredit} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="illustrationer" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold text-foreground">Illustrationer</h2>
        <p className="mt-1 text-sm text-muted">
          Illustrationerne på forsiden og i kommunetesten er fra{" "}
          <a
            href="https://undraw.co"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            unDraw
          </a>{" "}
          af Katerina Limpitsouni, tilpasset Kommunas farver. Ikonerne er fra{" "}
          <a
            href="https://tabler.io/icons"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Tabler Icons
          </a>{" "}
          (MIT-licens).
        </p>
      </section>
    </main>
  );
}

function TabelLink({ tabel }: { tabel: string }) {
  return (
    <a
      href={statistikbankenUrl(tabel)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
    >
      Danmarks Statistik, {tabel}
      <IconExternalLink className="h-3 w-3" />
    </a>
  );
}
