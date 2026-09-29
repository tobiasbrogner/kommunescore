"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { kommuneSlug } from "@/lib/kommuner/slug";

// Søgefeltet på forsiden: skriv en kommune og gå direkte til dens rapport.
export function KommuneSoeg({ kommunenavne }: { kommunenavne: string[] }) {
  const router = useRouter();
  const [soegning, setSoegning] = useState("");
  const [aaben, setAaben] = useState(false);

  const tekst = soegning.trim().toLowerCase();
  // Kommuner, der starter med teksten, kommer før dem, der blot indeholder den.
  const forslag = tekst
    ? kommunenavne
        .filter((n) => n.toLowerCase().includes(tekst))
        .sort(
          (a, b) =>
            Number(!a.toLowerCase().startsWith(tekst)) - Number(!b.toLowerCase().startsWith(tekst)) ||
            a.localeCompare(b, "da"),
        )
        .slice(0, 6)
    : [];

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
        if (forslag[0]) gaaTil(forslag[0]);
        else router.push("/kort");
      }}
    >
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          aria-label="Søg efter kommune"
          value={soegning}
          onChange={(e) => {
            setSoegning(e.target.value);
            setAaben(true);
          }}
          onFocus={() => setAaben(true)}
          onBlur={() => setAaben(false)}
          placeholder="Søg fx Aarhus, Silkeborg eller Gentofte"
          className="h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none transition-colors focus:border-accent"
        />

        {aaben && tekst !== "" && (
          <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-md">
            {forslag.map((navn) => (
              <li key={navn}>
                <button
                  type="button"
                  // mousedown i stedet for click, så feltets blur ikke lukker listen først.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    gaaTil(navn);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-foreground transition-colors duration-200 hover:bg-accent/10"
                >
                  {navn}
                </button>
              </li>
            ))}
            {forslag.length === 0 && (
              <li className="px-4 py-2.5 text-sm text-muted">Ingen kommuner matcher.</li>
            )}
          </ul>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" className="h-12 shrink-0">
        Se kommunen
      </Button>
    </form>
  );
}
