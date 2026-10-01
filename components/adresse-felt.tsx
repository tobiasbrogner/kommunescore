"use client";

import { useEffect, useRef, useState } from "react";
import { IconMapPin, IconX } from "@tabler/icons-react";
import { Spinner } from "@heroui/react";

export type Adresse = { tekst: string; lat: number; lon: number };

// Søgefelt til den personlige afstand på /kort: slår op i /api/adresse, mens man skriver,
// og viser forslag under feltet. Når en adresse er valgt, vises den med en knap til at
// fjerne den igen.
export function AdresseFelt({
  adresse,
  onVaelg,
}: {
  adresse: Adresse | null;
  onVaelg: (adresse: Adresse | null) => void;
}) {
  const [soegning, setSoegning] = useState("");
  const [forslag, setForslag] = useState<Adresse[]>([]);
  const [henter, setHenter] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [aaben, setAaben] = useState(false);
  const feltRef = useRef<HTMLDivElement | null>(null);

  // Søg først, når man holder en lille pause, så der ikke slås op for hvert tastetryk.
  useEffect(() => {
    // Under 3 tegn vises ingen forslagsliste, så de gamle forslag kan blive liggende.
    const q = soegning.trim();
    if (q.length < 3) return;
    const styring = new AbortController();
    const timer = setTimeout(async () => {
      setHenter(true);
      try {
        const svar = await fetch(`/api/adresse?q=${encodeURIComponent(q)}`, { signal: styring.signal });
        const data = await svar.json();
        if (!svar.ok) {
          setFejl(data.fejl ?? "Adressesøgningen fejlede.");
          setForslag([]);
        } else {
          setFejl(null);
          setForslag(data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setFejl("Adressesøgningen fejlede.");
      } finally {
        if (!styring.signal.aborted) setHenter(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      styring.abort();
    };
  }, [soegning]);

  useEffect(() => {
    const lukVedKlikUdenfor = (e: MouseEvent) => {
      if (feltRef.current && !feltRef.current.contains(e.target as Node)) setAaben(false);
    };
    document.addEventListener("mousedown", lukVedKlikUdenfor);
    return () => document.removeEventListener("mousedown", lukVedKlikUdenfor);
  }, []);

  if (adresse) {
    return (
      <div className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-xs">
        <IconMapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-foreground" title={adresse.tekst}>
          {adresse.tekst}
        </span>
        <button
          type="button"
          onClick={() => onVaelg(null)}
          className="shrink-0 rounded-md p-0.5 text-muted transition-colors hover:text-foreground"
          aria-label="Fjern adressen"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={feltRef} className="relative">
      <input
        type="search"
        value={soegning}
        onChange={(e) => {
          setSoegning(e.target.value);
          setAaben(true);
        }}
        onFocus={() => setAaben(true)}
        // Pil- og bogstavtaster må ikke fanges af menuen, panelet ligger i.
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Fx din arbejdsplads"
        aria-label="Adresse"
        className="h-7 w-full rounded-md border border-border bg-surface px-2 text-xs outline-none transition-colors focus:border-accent"
      />
      {aaben && soegning.trim().length >= 3 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-md">
          {forslag.map((f) => (
            <li key={`${f.tekst}-${f.lat}-${f.lon}`}>
              <button
                type="button"
                onClick={() => {
                  onVaelg(f);
                  setSoegning("");
                  setAaben(false);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs text-muted transition-colors hover:bg-accent/10 hover:text-foreground"
              >
                {f.tekst}
              </button>
            </li>
          ))}
          {forslag.length === 0 && (
            <li className="px-2.5 py-1.5 text-xs text-muted">
              {henter ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" /> Søger…
                </span>
              ) : (
                (fejl ?? "Ingen adresser matcher.")
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
