"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type IkonKort = Record<string, string>;

let ikonPromise: Promise<IkonKort> | null = null;
export function hentIkoner() {
  ikonPromise ??= fetch("/tabler-ikoner.json").then((res) => res.json());
  return ikonPromise;
}

// Ikoner, som serveren allerede har slået op (se lib/ikoner.ts og app/layout.tsx). Er et
// ikon her, tegnes det med det samme uden at hente hele ikonfilen.
const ForudhentedeIkoner = createContext<IkonKort>({});

export function IkonProvider({ ikoner, children }: { ikoner: IkonKort; children: React.ReactNode }) {
  return <ForudhentedeIkoner.Provider value={ikoner}>{children}</ForudhentedeIkoner.Provider>;
}

export function humaniser(navn: string) {
  return navn.replace(/-/g, " ");
}

export function Ikon({ markup, className }: { markup: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export function PladsholderIkon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M4 15l4 -4a2 2 0 0 1 2.5 0l4.5 4" />
      <path d="M14 14l1 -1a2 2 0 0 1 2.5 0l2.5 2.5" />
    </svg>
  );
}

/** Viser et navngivet Tabler-ikon (fra kategoriers `ikon`-felt), med pladsholder mens listen indlæses. */
export function KategoriIkon({ navn, className }: { navn: string | null; className?: string }) {
  const forudhentet = useContext(ForudhentedeIkoner);
  const kendt = navn ? forudhentet[navn] : undefined;
  const [markup, setMarkup] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Kun ikoner, serveren ikke har sendt med (fx et nyt ikon i admin-panelet), hentes.
    if (!navn || kendt) return;
    let aktiv = true;
    hentIkoner().then((ikoner) => {
      if (aktiv) setMarkup(ikoner[navn]);
    });
    return () => {
      aktiv = false;
    };
  }, [navn, kendt]);

  const svg = kendt ?? markup;
  if (navn && svg) return <Ikon markup={svg} className={className} />;
  return <PladsholderIkon className={className} />;
}
