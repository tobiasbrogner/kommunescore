"use client"; // Fejlsider skal være klientkomponenter.

import "./globals.css";
import { useEffect, useState } from "react";
import { Geist } from "next/font/google";
import { buttonVariants } from "@heroui/styles";
import { IconHome, IconRefresh } from "@tabler/icons-react";
import { Logo } from "@/components/logo";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

// Sikkerhedsnet, hvis selve layoutet (header, footer) fejler; almindelige fejl på en side
// vises af app/error.tsx. Siden erstatter hele layoutet og skal derfor selv have <html>,
// styles og skrift. Temaet (lyst/mørkt) læses, som next-themes gemmer det.
export default function GlobalFejl({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [moerk, setMoerk] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    let tema: string | null = null;
    try {
      tema = localStorage.getItem("theme");
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage findes kun i browseren.
    setMoerk(
      tema === "dark" ||
        ((!tema || tema === "system") && matchMedia("(prefers-color-scheme: dark)").matches),
    );
  }, []);

  return (
    <html lang="da" className={moerk ? "dark" : undefined}>
      <body className={`${geist.variable} min-h-screen bg-background text-foreground antialiased`}>
        <title>Noget gik galt | Kommuna</title>
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Almindelige links her, så hele siden indlæses forfra. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- se ovenfor. */}
          <a href="/" aria-label="Kommuna, til forsiden">
            <Logo className="h-8" />
          </a>
          <p className="mt-16 text-sm font-medium tracking-wide text-accent">Noget gik galt</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Kommuna kunne ikke vises lige nu.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            Det skyldes som regel en kort forstyrrelse hos os. Prøv igen om et øjeblik.
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
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- se ovenfor. */}
            <a href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <IconHome className="h-5 w-5" />
              Forsiden
            </a>
          </div>
          {error.digest && (
            <p className="mt-10 text-sm text-muted">
              Fejlkode: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
