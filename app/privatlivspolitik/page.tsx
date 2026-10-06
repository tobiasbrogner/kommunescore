import type { Metadata } from "next";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { IconArrowLeft } from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Privatlivspolitik | Kommuna",
  description: "Hvilke oplysninger Kommuna behandler, hvorfor, og hvilke rettigheder du har.",
};

// Opdatér datoen, når teksten ændres.
const SIDST_OPDATERET = "6. oktober 2026";

// Hvem der står bag siden. Skal udfyldes med navn og e-mail, før siden går i luften.
const DATAANSVARLIG = "Kommuna";

// Privatlivspolitikken. Hold den i takt med koden: nye tjenester, der får brugerens data
// (fx statistik eller nyhedsbrev), skal med under "Hvem får oplysningerne".
export default function PrivatlivspolitikSide() {
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
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Privatlivspolitik
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Kommuna bruger ikke annoncer, statistik eller sporing. Vi behandler kun de
          oplysninger, der skal til for at siden virker, og dem, du selv sender til os.
        </p>
        <p className="mt-2 text-xs text-muted">Sidst opdateret {SIDST_OPDATERET}</p>
      </header>

      <Afsnit titel="Hvem står bag">
        <p>
          {DATAANSVARLIG} er dataansvarlig for de oplysninger, der behandles på siden. Du kan
          kontakte os via knappen &quot;Giv feedback&quot; nederst på alle sider. Skriv din e-mail, hvis
          du vil have svar.
        </p>
      </Afsnit>

      <Afsnit titel="Hvad vi behandler og hvorfor">
        <Punkter>
          <li>
            <strong className="font-medium text-foreground">Feedback.</strong> Når du sender
            feedback, gemmer vi din besked, hvilken side du var på, din browsertype og din
            e-mail, hvis du skriver den. Vi bruger det til at forbedre siden og svare dig.
            Vi sletter feedback, når den er behandlet, og senest efter 12 måneder.
          </li>
          <li>
            <strong className="font-medium text-foreground">AI-chatten.</strong> Det, du skriver
            i chatten, sendes til Anthropic, som laver svarene. Vi gemmer ikke samtalen. Du
            behøver ikke skrive noget personligt for at bruge chatten. Chatten er frivillig, og
            resten af siden virker uden den.
          </li>
          <li>
            <strong className="font-medium text-foreground">Adressesøgning.</strong> Når du
            søger en adresse på kortet, sendes søgningen videre til Dataforsyningen og Photon,
            som finder adressen. Vi gemmer ikke søgningen på vores server.
          </li>
          <li>
            <strong className="font-medium text-foreground">IP-adresse.</strong> Din IP-adresse
            bruges kort i hukommelsen på serveren til at begrænse, hvor mange beskeder,
            søgninger og feedbacks der kan sendes, så siden ikke bliver misbrugt. Den gemmes
            ikke i databasen, kun midlertidigt i serverens hukommelse.
          </li>
        </Punkter>
        <p className="mt-3 text-xs">
          Retsgrundlag efter GDPR art. 6, stk. 1: feedback sker med dit samtykke (litra a).
          AI-chatten, adressesøgningen og begrænsningen pr. IP-adresse sker af hensyn til vores
          legitime interesse i at drive siden (litra f).
        </p>
      </Afsnit>

      <Afsnit titel="Det, der gemmes i din browser">
        <p>
          Vi bruger ingen cookies til statistik eller annoncer, og derfor er der ikke noget
          cookie-banner. Nogle valg gemmes i din egen browser (localStorage), så de er der, næste
          gang du kommer. De bliver ikke sendt til os, og du kan slette dem ved at rydde
          browserdata for siden:
        </p>
        <Punkter>
          <li>dine favoritkommuner</li>
          <li>din adresse og dine vægte på kortet, og om Prioritet er åben</li>
          <li>dine svar i kommunetesten (kun indtil du lukker fanen)</li>
          <li>din e-mail i feedbackformularen, så du ikke skal skrive den igen</li>
        </Punkter>
        <p className="mt-3">
          Administratorer, der logger ind, får en nødvendig login-cookie, som udløber efter 7
          dage.
        </p>
      </Afsnit>

      <Afsnit titel="Hvem får oplysningerne">
        <Punkter>
          <li>
            <strong className="font-medium text-foreground">Vores hostingudbyder</strong>, som
            driver serveren og databasen.
          </li>
          <li>
            <strong className="font-medium text-foreground">Anthropic</strong> (USA) får
            teksten fra AI-chatten, men kun hvis du bruger chatten. Overførslen til USA er
            beskyttet af EU-Kommissionens standardkontrakter.
          </li>
          <li>
            <strong className="font-medium text-foreground">Dataforsyningen</strong>{" "}
            (Klimadatastyrelsen) og{" "}
            <strong className="font-medium text-foreground">Photon</strong> (komoot, Tyskland)
            får de adresser, du søger efter.
          </li>
          <li>
            <strong className="font-medium text-foreground">OpenMapTiles</strong> leverer
            skrifttypen på kortet. Som ved alle andre hjemmesider, din browser henter noget fra,
            får de din IP-adresse.
          </li>
        </Punkter>
        <p className="mt-3">Vi sælger aldrig oplysninger til nogen.</p>
      </Afsnit>

      <Afsnit titel="Dine rettigheder">
        <p>
          Du har ret til at få at vide, hvilke oplysninger vi har om dig, og til at få dem rettet
          eller slettet. Du kan også trække et samtykke tilbage og gøre indsigelse mod
          behandlingen. Kontakt os via feedbackknappen. Er du utilfreds, kan du klage til{" "}
          <a
            href="https://www.datatilsynet.dk"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Datatilsynet
          </a>
          .
        </p>
      </Afsnit>
    </main>
  );
}

function Afsnit({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-foreground">{titel}</h2>
      <div className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function Punkter({ children }: { children: ReactNode }) {
  return <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 first:mt-0">{children}</ul>;
}
