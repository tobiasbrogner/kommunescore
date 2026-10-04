"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { sammenlignKommunenavne } from "@/lib/kommuner/navn";
import { kommuneSlug } from "@/lib/kommuner/slug";

// Søgefeltet på forsiden: skriv en kommune og gå direkte til dens rapport. Forslagene kan
// vælges med mus eller piletaster (combobox-mønsteret), og Enter går til det markerede.
export function KommuneSoeg({ kommunenavne }: { kommunenavne: string[] }) {
  const router = useRouter();
  const listeId = useId();
  const [soegning, setSoegning] = useState("");
  const [aaben, setAaben] = useState(false);
  const [markeret, setMarkeret] = useState(0);

  const tekst = soegning.trim().toLowerCase();
  // Kommuner, der starter med teksten, kommer før dem, der blot indeholder den.
  const forslag = tekst
    ? kommunenavne
        .filter((n) => n.toLowerCase().includes(tekst))
        .sort(
          (a, b) =>
            Number(!a.toLowerCase().startsWith(tekst)) - Number(!b.toLowerCase().startsWith(tekst)) ||
            sammenlignKommunenavne(a, b),
        )
        .slice(0, 6)
    : [];
  const visListe = aaben && tekst !== "";
  const aktivt = Math.min(markeret, Math.max(forslag.length - 1, 0));

  const gaaTil = (navn: string) => {
    setAaben(false);
    router.push(`/kommune/${kommuneSlug(navn)}`);
  };

  return (
    <form
      role="search"
      className="relative flex max-w-2xl flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (forslag[aktivt]) gaaTil(forslag[aktivt]);
        else router.push("/kort");
      }}
    >
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          role="combobox"
          aria-label="Søg efter kommune"
          aria-expanded={visListe}
          aria-controls={listeId}
          aria-autocomplete="list"
          aria-activedescendant={visListe && forslag.length > 0 ? `${listeId}-${aktivt}` : undefined}
          value={soegning}
          onChange={(e) => {
            setSoegning(e.target.value);
            setMarkeret(0);
            setAaben(true);
          }}
          onFocus={() => setAaben(true)}
          onBlur={() => setAaben(false)}
          onKeyDown={(e) => {
            if (!visListe || forslag.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMarkeret((aktivt + 1) % forslag.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setMarkeret((aktivt - 1 + forslag.length) % forslag.length);
            } else if (e.key === "Escape") {
              setAaben(false);
            }
          }}
          placeholder="Fx Aarhus eller Silkeborg"
          className="h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none transition-colors focus:border-accent"
        />

        {visListe && (
          <ul
            id={listeId}
            role="listbox"
            aria-label="Kommuner"
            className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-md"
          >
            {forslag.map((navn, i) => (
              <li
                key={navn}
                id={`${listeId}-${i}`}
                role="option"
                aria-selected={i === aktivt}
                // mousedown i stedet for click, så feltets blur ikke lukker listen først.
                onMouseDown={(e) => {
                  e.preventDefault();
                  gaaTil(navn);
                }}
                onMouseEnter={() => setMarkeret(i)}
                className={`cursor-pointer px-4 py-2.5 text-sm text-foreground transition-colors duration-200 ${
                  i === aktivt ? "bg-accent/10" : ""
                }`}
              >
                {navn}
              </li>
            ))}
            {forslag.length === 0 && (
              <li className="px-4 py-2.5 text-sm text-muted">Ingen kommuner matcher.</li>
            )}
          </ul>
        )}
      </div>

      <Button type="submit" variant="outline" size="lg" className="h-12 shrink-0">
        Se kommunen
      </Button>
    </form>
  );
}
