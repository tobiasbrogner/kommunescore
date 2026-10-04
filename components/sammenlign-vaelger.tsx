"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";
import { IconPlus, IconX } from "@tabler/icons-react";

type Kommune = { navn: string; slug: string };

// Vælger øverst på /sammenlign: de valgte kommuner som chips med et kryds og et søgefelt
// til at tilføje flere. Valget står i adressen (?kommuner=aarhus,odense), så siden kan
// deles; serveren henter tallene ud fra den.
export function SammenlignVaelger({
  valgte,
  alle,
  maks,
}: {
  valgte: Kommune[];
  alle: Kommune[];
  maks: number;
}) {
  const router = useRouter();
  const [venter, startOverfoersel] = useTransition();
  const [soegning, setSoegning] = useState("");
  const [aaben, setAaben] = useState(false);
  const feltRef = useRef<HTMLInputElement | null>(null);

  const saetValg = (slugs: string[]) => {
    const adresse = slugs.length > 0 ? `/sammenlign?kommuner=${slugs.join(",")}` : "/sammenlign";
    startOverfoersel(() => router.replace(adresse, { scroll: false }));
  };

  const valgteSlugs = valgte.map((k) => k.slug);
  const fuld = valgte.length >= maks;

  const forslag = useMemo(() => {
    const q = soegning.trim().toLowerCase();
    if (!q) return [];
    return alle
      .filter((k) => !valgteSlugs.includes(k.slug) && k.navn.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.navn.toLowerCase().startsWith(q)) - Number(!b.navn.toLowerCase().startsWith(q)))
      .slice(0, 8);
  }, [soegning, alle, valgteSlugs]);

  const tilfoej = (k: Kommune) => {
    saetValg([...valgteSlugs, k.slug]);
    setSoegning("");
    setAaben(false);
    feltRef.current?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {valgte.map((k) => (
        <span
          key={k.slug}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-surface pl-3.5 pr-1 text-sm font-medium text-foreground"
        >
          {k.navn}
          <button
            type="button"
            onClick={() => saetValg(valgteSlugs.filter((s) => s !== k.slug))}
            aria-label={`Fjern ${k.navn}`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}

      {!fuld && (
        <div className="relative">
          <IconPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            ref={feltRef}
            type="search"
            value={soegning}
            onChange={(e) => {
              setSoegning(e.target.value);
              setAaben(true);
            }}
            onFocus={() => setAaben(true)}
            onBlur={() => setTimeout(() => setAaben(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && forslag[0]) tilfoej(forslag[0]);
              if (e.key === "Escape") setAaben(false);
            }}
            placeholder={valgte.length === 0 ? "Tilføj en kommune" : "Tilføj kommune"}
            aria-label="Tilføj kommune til sammenligningen"
            className="h-9 w-56 rounded-full border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent"
          />
          {aaben && soegning.trim() !== "" && (
            <ul className="absolute z-20 mt-1 max-h-72 w-64 overflow-auto rounded-xl border border-border bg-surface py-1 shadow-lg">
              {forslag.map((k) => (
                <li key={k.slug}>
                  <button
                    type="button"
                    // mousedown, så valget sker før feltet mister fokus og listen lukker.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      tilfoej(k);
                    }}
                    className="w-full px-3.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent/10"
                  >
                    {k.navn}
                  </button>
                </li>
              ))}
              {forslag.length === 0 && (
                <li className="px-3.5 py-2 text-sm text-muted">Ingen kommuner matcher.</li>
              )}
            </ul>
          )}
        </div>
      )}

      {fuld && (
        <span className="text-xs text-muted">
          Højst {maks} kommuner ad gangen – fjern en for at tilføje en anden.
        </span>
      )}

      {venter && <Spinner size="sm" />}
    </div>
  );
}
