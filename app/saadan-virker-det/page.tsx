import type { Metadata } from "next";
import NextLink from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Sådan virker det | Kommuna",
  description: "Hvordan Kommuna regner kommunernes score ud.",
};

// Hvordan scorerne regnes ud. Hvor tallene kommer fra, står for sig på /kilder.
// Afsnittet #beregning linkes til fra infoboksen under Prioritet på /kort.
export default function SaadanVirkerDetSide() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <NextLink
        href="/kort"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Til kortet
      </NextLink>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Sådan virker det
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Alle tal på Kommuna kommer fra offentlige statistikker. Her kan du se, hvilke
          tal hver kategori bygger på, hvor de kommer fra, og hvordan de bliver til en score.
        </p>
      </header>

      <section id="beregning" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold text-foreground">Sådan regnes scoren ud</h2>
        <ul className="mt-3 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            Hvert nøgletal omregnes til en score fra 50 til 100 ved at sammenligne alle 98
            kommuner. For fx priser og ledighed er det laveste tal det bedste.
          </li>
          <li>
            Skalaen går fra de 5 % dårligste til de 5 % bedste kommuner: de mest ekstreme får
            50 eller 100, og resten fordeles jævnt imellem. Så presser få ekstreme kommuner, fx
            boligpriserne i hovedstadsområdet, ikke alle andre sammen i den ene ende.
          </li>
          <li>
            En kategoris score er gennemsnittet af dens nøgletal. Mangler en kommune et tal,
            fordi det ikke er opgjort, tæller de andre nøgletal i kategorien.
          </li>
          <li>
            Den samlede score er et vægtet gennemsnit af kategorierne. Under Prioritet på kortet
            kan du selv bestemme, hvor meget hver kategori vægter.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          Tallene bag hver kategori og deres kilder finder du under{" "}
          <NextLink href="/kilder" className="font-medium text-accent hover:underline">
            Kilder
          </NextLink>
          .
        </p>
      </section>
    </main>
  );
}
