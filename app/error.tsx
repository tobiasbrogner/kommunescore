"use client"; // Fejlsider skal være klientkomponenter.

import { useEffect } from "react";
import NextLink from "next/link";
import { buttonVariants } from "@heroui/styles";
import { IconHome, IconPlugConnectedX, IconRefresh } from "@tabler/icons-react";

// Vises, når en side fejler, fx hvis databasen ikke svarer eller er løbet tør for
// forbindelser. Header og footer bliver stående; kun selve siden skiftes ud.
// "Prøv igen" henter og tegner siden igen (retry), da fejlen ofte er forbigående.
export default function Fejl({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <title>Noget gik galt | Kommuna</title>
      <div className="motion-rise">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <IconPlugConnectedX className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-8 text-sm font-medium tracking-wide text-accent">Noget gik galt</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Vi kunne ikke hente siden lige nu.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
          Det skyldes som regel en kort forstyrrelse hos os, ikke noget du har gjort. Prøv igen om
          et øjeblik. Hjælper det ikke, kan du gå til forsiden.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            <IconRefresh className="h-5 w-5" />
            Prøv igen
          </button>
          <NextLink href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <IconHome className="h-5 w-5" />
            Forsiden
          </NextLink>
        </div>
        {/* Fejlkoden passer til serverens log, så en bestemt fejl kan findes igen. */}
        {error.digest && (
          <p className="mt-10 text-sm text-muted">
            Fejlkode: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </section>
  );
}
