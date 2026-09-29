"use client";

import { useEffect, useSyncExternalStore } from "react";
import { kommuneSlug } from "@/lib/kommuner/slug";

// Brugerens favoritkommuner (kommunekoder). Gemmes i browseren, så der ikke skal
// logges ind; de følger derfor kun den enkelte browser. Et delt link
// (/kort?favoritter=aarhus,fanoe) lægger favoritterne til listen.

const LAGER_NOEGLE = "kommune-favoritter";
const FAVORIT_PARAMETER = "favoritter";

type Tilstand = { koder: string[]; fraLink: boolean };

// På serveren (og ved første render i browseren) er der ingen favoritter.
const SERVER_TILSTAND: Tilstand = { koder: [], fraLink: false };

// Lille lager uden for React, så browserens lager kan læses via useSyncExternalStore.
let tilstand: Tilstand | null = null;
const lyttere = new Set<() => void>();

function laesGemte(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(LAGER_NOEGLE) ?? "[]");
    return Array.isArray(data) ? data.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function hentTilstand(): Tilstand {
  tilstand ??= { koder: laesGemte(), fraLink: false };
  return tilstand;
}

function saetTilstand(ny: Tilstand) {
  tilstand = ny;
  try {
    localStorage.setItem(LAGER_NOEGLE, JSON.stringify(ny.koder));
  } catch {
    // Privat browsing o.l.: favoritterne virker stadig, til siden lukkes.
  }
  lyttere.forEach((lyt) => lyt());
}

function abonner(lyt: () => void) {
  lyttere.add(lyt);
  // Ændringer i en anden fane.
  const vedLager = (e: StorageEvent) => {
    if (e.key !== LAGER_NOEGLE) return;
    tilstand = { ...hentTilstand(), koder: laesGemte() };
    lyt();
  };
  window.addEventListener("storage", vedLager);
  return () => {
    lyttere.delete(lyt);
    window.removeEventListener("storage", vedLager);
  };
}

export function useFavoritter(kommuner: { kode: string; navn: string }[]) {
  const { koder: favoritter, fraLink } = useSyncExternalStore(
    abonner,
    hentTilstand,
    () => SERVER_TILSTAND,
  );

  // Et delt link lægges til favoritterne én gang, og parameteren fjernes derefter,
  // så en genindlæsning ikke lægger dem til igen.
  useEffect(() => {
    const url = new URL(window.location.href);
    const delte = url.searchParams.get(FAVORIT_PARAMETER);
    if (delte === null) return;

    const kodePrSlug = new Map(kommuner.map((k) => [kommuneSlug(k.navn), k.kode]));
    const nye = delte.split(",").flatMap((slug) => kodePrSlug.get(slug.trim()) ?? []);
    const nu = hentTilstand();
    saetTilstand({ koder: [...new Set([...nu.koder, ...nye])], fraLink: nye.length > 0 });

    url.searchParams.delete(FAVORIT_PARAMETER);
    window.history.replaceState(null, "", url);
    // Kun ved første indlæsning; kommunelisten ændrer sig ikke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skiftFavorit = (kode: string) => {
    const nu = hentTilstand();
    const koder = nu.koder.includes(kode)
      ? nu.koder.filter((k) => k !== kode)
      : [...nu.koder, kode];
    saetTilstand({ ...nu, koder });
  };

  // Link, der viser favoritterne i en anden browser, fx /kort?favoritter=aarhus,fanoe.
  const delLink = () => {
    const navnPrKode = new Map(kommuner.map((k) => [k.kode, k.navn]));
    const slugs = favoritter.flatMap((kode) => {
      const navn = navnPrKode.get(kode);
      return navn ? [kommuneSlug(navn)] : [];
    });
    return `${window.location.origin}/kort?${FAVORIT_PARAMETER}=${slugs.join(",")}`;
  };

  return { favoritter, skiftFavorit, delLink, fraLink };
}
