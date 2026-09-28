import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { REGION_NAVNE } from "@/lib/kommuner/regioner";
import {
  GRUPPE_NAVNE,
  LANDSDEL_NAVNE,
  gruppeForKommune,
  kommuneMatcherFilterId,
  kommuneMatcherGruppeId,
} from "@/lib/kommuner/omraader";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";
import { hentGeoFakta, hentKommuneRapport } from "@/lib/scores/kommune-rapport";

// Værktøjer AI-chatten kan bruge til at slå data op. De læser kun og ændrer intet.
// Svarene holdes små (kun de tal botten skal bruge), da hvert token koster.

const STANDARD_VAEGT = 50;
const MAKS_ANTAL = 10;
const OMRAADE_IDER = [...Object.keys(REGION_NAVNE), ...Object.keys(LANDSDEL_NAVNE)];

export const CHAT_VAERKTOEJER: Anthropic.Tool[] = [
  {
    name: "find_kommuner",
    description:
      "Rangér kommunerne efter brugerens prioriteter, præcis som kortet gør med Prioritet, Område og Gruppe. Brug den til at anbefale kommuner og til at svare på 'hvor er det bedst/billigst …'.",
    input_schema: {
      type: "object",
      properties: {
        vaegte: {
          type: "object",
          description:
            "Vægt 0-100 pr. kategori-slug. Kategorier, der udelades, får 50 (standard). 0 betyder, at kategorien ikke tæller med.",
          additionalProperties: { type: "number", minimum: 0, maximum: 100 },
        },
        omraader: {
          type: "array",
          description: "Begræns til regioner (regionskode) eller landsdele. Tom = hele landet.",
          items: { type: "string", enum: OMRAADE_IDER },
        },
        grupper: {
          type: "array",
          description: "Begræns til kommunegrupper (id). Tom = alle grupper.",
          items: { type: "string", enum: Object.keys(GRUPPE_NAVNE) },
        },
        antal: {
          type: "integer",
          description: `Hvor mange kommuner der skal returneres (1-${MAKS_ANTAL}).`,
          minimum: 1,
          maximum: MAKS_ANTAL,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "hent_kommune",
    description:
      "Hent fakta og scorer for én kommune: samlet score og placering, score og placering i hver kategori, de rå nøgletal, styrker og fokusområder samt en kort beskrivelse.",
    input_schema: {
      type: "object",
      properties: {
        navn: { type: "string", description: "Kommunens navn, fx 'Aarhus' eller 'Høje-Taastrup'." },
      },
      required: ["navn"],
      additionalProperties: false,
    },
  },
];

type FindInput = {
  vaegte?: Record<string, number>;
  omraader?: string[];
  grupper?: string[];
  antal?: number;
};

function erStrengListe(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

// Input valideres her, så et forkert kald giver en fejl til botten frem for et nedbrud.
function laesFindInput(input: unknown): FindInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { vaegte, omraader, grupper, antal } = input as Record<string, unknown>;
  if (vaegte !== undefined) {
    if (typeof vaegte !== "object" || vaegte === null) return null;
    if (!Object.values(vaegte).every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  }
  if (omraader !== undefined && !erStrengListe(omraader)) return null;
  if (grupper !== undefined && !erStrengListe(grupper)) return null;
  if (antal !== undefined && typeof antal !== "number") return null;
  return {
    vaegte: vaegte as Record<string, number> | undefined,
    omraader: omraader as string[] | undefined,
    grupper: grupper as string[] | undefined,
    antal: antal as number | undefined,
  };
}

async function findKommuner(input: FindInput) {
  const [{ kategorier, kommuner }, geo] = await Promise.all([
    getCachedKommuneScores(),
    hentGeoFakta(),
  ]);

  const vaegtFor = (slug: string) =>
    Math.min(100, Math.max(0, input.vaegte?.[slug] ?? STANDARD_VAEGT));
  const ukendteSlugs = Object.keys(input.vaegte ?? {}).filter(
    (slug) => !kategorier.some((k) => k.slug === slug),
  );

  const omraader = (input.omraader ?? []).filter((id) => OMRAADE_IDER.includes(id));
  const grupper = (input.grupper ?? []).filter((id) => id in GRUPPE_NAVNE);
  const antal = Math.min(MAKS_ANTAL, Math.max(1, Math.round(input.antal ?? 5)));

  const regionFor = (kode: string) => geo.get(kode)?.regionskode ?? "";
  const matchende = kommuner.filter(
    (k) =>
      (omraader.length === 0 ||
        omraader.some((id) => kommuneMatcherFilterId(k.kode, regionFor(k.kode), id))) &&
      (grupper.length === 0 || grupper.some((id) => kommuneMatcherGruppeId(k.kode, id))),
  );

  // Samme vægtning som kortet: et vægtet gennemsnit af kategoriscorerne.
  const vaegtetScore = (scorer: Record<number, number>) => {
    let sum = 0;
    let sumVaegt = 0;
    for (const kat of kategorier) {
      const vaegt = vaegtFor(kat.slug);
      if (vaegt <= 0) continue;
      sum += (scorer[kat.id] ?? STANDARD_VAEGT) * vaegt;
      sumVaegt += vaegt;
    }
    return sumVaegt > 0 ? sum / sumVaegt : STANDARD_VAEGT;
  };

  const rangeret = matchende
    .map((k) => ({ k, score: vaegtetScore(k.kategorier) }))
    .sort((a, b) => b.score - a.score || a.k.navn.localeCompare(b.k.navn, "da"));

  return {
    antalMatchende: rangeret.length,
    brugteVaegte: Object.fromEntries(kategorier.map((k) => [k.slug, vaegtFor(k.slug)])),
    ...(ukendteSlugs.length > 0 && { ukendteKategorier: ukendteSlugs }),
    kommuner: rangeret.slice(0, antal).map(({ k, score }, i) => {
      const gruppe = gruppeForKommune(k.kode);
      return {
        placering: i + 1,
        navn: k.navn,
        region: REGION_NAVNE[regionFor(k.kode)] ?? null,
        gruppe: gruppe ? GRUPPE_NAVNE[gruppe] : null,
        score: Math.round(score),
        kategorier: Object.fromEntries(
          kategorier.map((kat) => [kat.navn, Math.round(k.kategorier[kat.id] ?? STANDARD_VAEGT)]),
        ),
        rapport: `/kommune/${kommuneSlug(k.navn)}`,
      };
    }),
  };
}

// Finder kommunen ud fra navnet, også når brugeren skriver "Aarhus Kommune" eller "århus".
async function findSlug(navn: string) {
  const { kommuner } = await getCachedKommuneScores();
  const soeg = kommuneSlug(navn.replace(/\bkommune\b/gi, ""));
  if (!soeg) return null;
  const slugs = kommuner.map((k) => kommuneSlug(k.navn));
  return (
    slugs.find((s) => s === soeg) ??
    slugs.find((s) => s.startsWith(soeg)) ??
    slugs.find((s) => s.includes(soeg)) ??
    null
  );
}

async function hentKommune(navn: string) {
  const slug = await findSlug(navn);
  const rapport = slug ? await hentKommuneRapport(slug) : null;
  if (!rapport) return { fejl: `Fandt ingen kommune ved navn "${navn}".` };

  const gruppe = gruppeForKommune(rapport.kode);
  return {
    navn: rapport.navn,
    region: rapport.regionNavn,
    gruppe: gruppe ? GRUPPE_NAVNE[gruppe] : null,
    stoersteBy: rapport.om.stoersteBy,
    indbyggere: rapport.om.indbyggere,
    arealKm2: rapport.om.arealKm2 === null ? null : Math.round(rapport.om.arealKm2),
    beskrivelse: rapport.om.beskrivelse,
    samlet: {
      score: Math.round(rapport.samlet.score),
      placering: rapport.samlet.rang,
      ud_af: rapport.samlet.antal,
    },
    styrker: rapport.profil.styrker.map((p) => `${p.kategori.navn}: ${p.tekst}`),
    fokusomraader: rapport.profil.fokus.map((p) => `${p.kategori.navn}: ${p.tekst}`),
    kategorier: rapport.kategorier.map((k) => ({
      kategori: k.kategori.navn,
      score: Math.round(k.score),
      placering: k.rang,
      noegletal: k.noegletal.map((n) => ({
        navn: n.navn,
        vaerdi: n.vaerdi,
        enhed: n.enhed,
        landsgennemsnit: Math.round(n.gennemsnit * 10) / 10,
        placering: n.rang,
        [n.retning === "lavere_bedre" ? "lavereErBedre" : "hoejereErBedre"]: true,
      })),
    })),
    rapport: `/kommune/${slug}`,
  };
}

export async function koerVaerktoej(navn: string, input: unknown): Promise<unknown> {
  if (navn === "find_kommuner") {
    const laest = laesFindInput(input);
    if (!laest) return { fejl: "Ugyldigt input til find_kommuner." };
    return findKommuner(laest);
  }
  if (navn === "hent_kommune") {
    const kommune = (input as { navn?: unknown } | null)?.navn;
    if (typeof kommune !== "string") return { fejl: "Ugyldigt input til hent_kommune." };
    return hentKommune(kommune);
  }
  return { fejl: `Ukendt værktøj: ${navn}` };
}
