"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, preload } from "react-dom";
import {
  Map as MapLibreMap,
  NavigationControl,
  type IControl,
  type GeoJSONSource,
  type StyleSpecification,
  getVersion,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre 6 finder ikke selv sin worker, når Next bundler pakken; den serveres fra
// public/ (kopieret af scripts/kopier-maplibre-worker.ts).
setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);
import {
  Button,
  Description,
  Dropdown,
  Header,
  Label,
  Separator,
  Slider,
  Spinner,
  Surface,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  type Selection,
} from "@heroui/react";
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconChevronDown,
  IconFileText,
  IconFilterOff,
  IconHeart,
  IconHeartFilled,
  IconLink,
  IconWorldMap,
  IconChevronsDown,
  IconHome,
  IconLayoutGrid,
  IconLayoutColumns,
  IconArrowRight,
  IconBabyCarriage,
  IconBuildingSkyscraper,
  IconPigMoney,
  IconTrees,
  IconHelpCircle,
  IconKey,
  IconOld,
  IconCar,
  IconUserCircle,
  IconMap,
  IconMinus,
  IconPlus,
  IconSettings,
  IconSortAscending,
  IconSortDescending,
  IconTarget,
  IconTrendingUp,
  IconX,
} from "@tabler/icons-react";
import type { KategoriMeta, KommuneScore } from "@/lib/scores/compute";
import { AdresseFelt, type Adresse } from "@/components/adresse-felt";
import { AiChat } from "@/components/ai-chat";
import kommunePunkter from "@/data/kommune-punkter.json";
import { KategoriIkon } from "@/components/ikon";
import { useFavoritter } from "@/components/use-favoritter";
import { REGION_NAVNE } from "@/lib/kommuner/regioner";
import {
  GRUPPE_BESKRIVELSE,
  GRUPPE_NAVNE,
  LANDSDEL_NAVNE,
  kommuneMatcherFilterId,
  kommuneMatcherGruppeId,
} from "@/lib/kommuner/omraader";
import { polygonArealKm2 } from "@/lib/kommuner/areal";
import { navnePunkt } from "@/lib/kommuner/navne-punkt";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { formaterTal } from "@/lib/scores/formater";
import {
  byggKategoriFordelinger,
  byggKommuneProfil,
  type KommuneProfil,
  type ProfilPunkt,
} from "@/lib/scores/profil";

type Kommune = {
  kode: string;
  navn: string;
  regionskode: string;
};

const PRIORITET_STANDARD = 50;

// Kommunegruppernes id'er i Område-menuen, hvor de deler valg med regionerne og landsdelene.
const GRUPPE_PRAEFIKS = "gruppe-";

// Personlig pendling: skriver man en adresse i Pendling under Prioritet (fx sin
// arbejdsplads), får Pendling et ekstra nøgletal med afstanden i fugleflugt fra
// kommunernes største by (se data/kommune-punkter.json), som kan vælges i stedet for
// gennemsnittet. Nøgletallet findes kun i browseren og har et negativt id, så det ikke
// støder ind i nøgletallene fra databasen. Adressen gemmes i localStorage.
const PENDLING_SLUG = "pendling";
const AFSTAND_NOEGLETAL_ID = -1;
const AFSTAND_NOEGLETAL = "Afstand til din adresse";
const AFSTAND_VALG_ID = "min-adresse";
const ADRESSE_LAGER = "kommuna-adresse";
// Afstande herunder (km) tæller som "i samme by" og giver fuld score.
const AFSTAND_NAER = 3;

/** Afstand i km i fugleflugt mellem to punkter (haversine). */
function afstandKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Pendling med afstanden til adressen som et ekstra nøgletal, der kan vælges til. */
function medAfstandsNoegletal(kategori: KategoriMeta, adresse: Adresse): KategoriMeta {
  return {
    ...kategori,
    noegletal: [
      ...kategori.noegletal,
      {
        id: AFSTAND_NOEGLETAL_ID,
        navn: AFSTAND_NOEGLETAL,
        enhed: "km",
        beskrivelse: `Afstand i fugleflugt fra kommunens største by til ${adresse.tekst}. Den faktiske rejsevej er længere. Kortere afstand giver en højere score. Adressen gemmes kun i din browser.`,
        // Logaritmisk, så forskellen på 5 og 20 km tæller mere end på 200 og 215 km.
        skala: "logaritmisk",
        standardValgt: false,
      },
    ],
  };
}

/** Kommunernes scorer med afstanden til adressen lagt på som nøgletal under Pendling. */
function medAfstand(scorer: KommuneScore[], adresse: Adresse): KommuneScore[] {
  const punkter = kommunePunkter as Record<string, { lat: number; lon: number }>;
  const km = new Map(
    scorer.flatMap((s) => (punkter[s.kode] ? [[s.kode, afstandKm(punkter[s.kode], adresse)] as const] : [])),
  );
  // Logaritmisk skala fra 100 (inden for AFSTAND_NAER km) til 50 (den fjerneste kommune),
  // så forskellen på 5 og 20 km tæller mere end på 200 og 215 km. Uden den fælles
  // percentil-beskæring, som ellers giver de nærmeste kommuner samme topscore.
  const log = (d: number) => Math.log(Math.max(d, AFSTAND_NAER));
  const spaend = log(Math.max(...km.values())) - log(0);
  return scorer.map((s) => {
    const d = km.get(s.kode);
    if (d === undefined) return s;
    const andel = spaend > 0 ? (log(d) - log(0)) / spaend : 0;
    const afrundet = Math.round((100 - 50 * andel) * 10) / 10;
    return {
      ...s,
      noegletal: { ...s.noegletal, [AFSTAND_NOEGLETAL_ID]: afrundet },
      vaerdier: { ...s.vaerdier, [AFSTAND_NOEGLETAL_ID]: Math.round(d) },
    };
  });
}

// Kategorier, hvor man under Prioritet kan vælge, hvilke nøgletal der tæller (efter
// kategoriens slug). Alle er valgt fra start, og så tæller kategorien som normalt.
// Kommuner uden en værdi for de valgte nøgletal springes over i kategorien i stedet
// for at få bundscoren; deres samlede score regnes så ud fra de øvrige kategorier.
// noegletal er nøgletallets navn i databasen; forklaring vises ved mus over knappen.
type NoegletalValg = { id: string; label: string; forklaring: string; noegletal: string };
const NOEGLETAL_VALG: Record<string, NoegletalValg[]> = {
  // Antal siger mest om kommunens størrelse; tætheden skelner byer fra store landkommuner.
  indbyggertal: [
    {
      id: "antal",
      label: "Antal",
      forklaring: "Antal indbyggere i kommunen",
      noegletal: "Indbyggere",
    },
    {
      id: "taethed",
      label: "Tæthed",
      forklaring: "Indbyggere pr. km²; skelner byer fra store landkommuner",
      noegletal: "Indbyggere pr. km²",
    },
  ],
  // Pr. indbygger alene giver små turistkommuner topscore; antallet viser bylivet.
  // Antal står først som under Indbyggertal, så det står samme sted i begge kategorier.
  spisesteder: [
    {
      id: "antal",
      label: "Antal",
      forklaring: "Spisesteder i alt i kommunen; viser hvor meget byliv der er",
      noegletal: "Spisesteder i alt",
    },
    {
      id: "pr-indbygger",
      label: "Pr. indbygger",
      forklaring: "Spisesteder pr. 1.000 indbyggere",
      noegletal: "Spisesteder pr. 1.000 indbyggere",
    },
  ],
  boligpriser: [
    {
      id: "hus",
      label: "Parcel/Rækkehus",
      forklaring: "Parcelhuse (villaer) og rækkehuse",
      noegletal: "Parcel-/rækkehus",
    },
    {
      id: "lejlighed",
      label: "Ejerlejlighed",
      forklaring: "Ejerlejligheder",
      noegletal: "Ejerlejlighed",
    },
  ],
  // Grundskyld betales kun af boligejere, så lejere kan fravælge den.
  kommuneskat: [
    {
      id: "kommuneskat",
      label: "Kommuneskat",
      forklaring: "Kommunal udskrivningsprocent (skat af indkomst)",
      noegletal: "Kommuneskat",
    },
    {
      id: "grundskyld",
      label: "Grundskyld",
      forklaring: "Grundskyldspromille; betales kun af boligejere",
      noegletal: "Grundskyldspromille",
    },
  ],
  // Andelen viser, hvor grøn kommunen er; pr. indbygger viser, hvor meget natur der er at dele.
  natur: [
    {
      id: "andel",
      label: "Andel",
      forklaring: "Andel af kommunens areal, der er natur og grønne områder",
      noegletal: "Andel natur og grønne områder",
    },
    {
      id: "pr-indbygger",
      label: "Pr. indbygger",
      forklaring: "Kvadratmeter natur pr. indbygger; tyndt befolkede kommuner ligger højt",
      noegletal: "Natur pr. indbygger",
    },
  ],
  // "Min adresse" findes kun, når man har skrevet en adresse i Pendling (se medAfstand).
  [PENDLING_SLUG]: [
    {
      id: "gennemsnit",
      label: "Gennemsnit",
      forklaring: "Hvor langt de beskæftigede i kommunen pendler i gennemsnit",
      noegletal: "Pendlingsafstand",
    },
    {
      id: AFSTAND_VALG_ID,
      label: "Min adresse",
      forklaring: "Afstand i fugleflugt fra kommunens største by til din adresse",
      noegletal: AFSTAND_NOEGLETAL,
    },
  ],
  // Foreningslivet og anlæggene kan vælges hver for sig; begge tæller fra start.
  idraet: [
    {
      id: "medlemmer",
      label: "Foreninger",
      forklaring: "Medlemskaber af idrætsforeninger i procent af befolkningen",
      noegletal: "Medlemskaber af idrætsforeninger",
    },
    {
      id: "anlaeg",
      label: "Anlæg",
      forklaring: "Idrætsanlæg pr. 10.000 indbyggere, fx haller, baner og svømmehaller",
      noegletal: "Idrætsanlæg pr. 10.000 indbyggere",
    },
  ],
};

// Færdige profiler, der sætter Prioritet med ét klik (efter kategoriens slug). Kategorier,
// der ikke står i vaegte, får standardvægten; noegletal vælger id'er fra NOEGLETAL_VALG
// (mangler den for en kategori, gælder valget fra start). Alle kategorier er slået til.
type Profil = {
  id: string;
  navn: string;
  beskrivelse: string;
  ikon: typeof IconHome;
  vaegte: Record<string, number>;
  noegletal?: Record<string, string[]>;
};
const PROFILER: Profil[] = [
  {
    id: "boernefamilie",
    navn: "Børnefamilie",
    beskrivelse: "Billig børnepasning, tryghed og hus",
    ikon: IconBabyCarriage,
    vaegte: {
      boern: 100,
      tryghed: 80,
      boligpriser: 70,
      jobmuligheder: 60,
      kommuneskat: 50,
      indbyggertal: 20,
      spisesteder: 20,
      idraet: 70,
      natur: 60,
      sundhed: 60,
      pendling: 50,
    },
    noegletal: { boligpriser: ["hus"] },
  },
  {
    id: "pensionist",
    navn: "Pensionist",
    beskrivelse: "Tryghed, sundhed og lav skat – job og børn tæller ikke",
    ikon: IconOld,
    vaegte: {
      tryghed: 100,
      sundhed: 100,
      kommuneskat: 80,
      natur: 70,
      spisesteder: 60,
      boligpriser: 50,
      indbyggertal: 40,
      idraet: 40,
      jobmuligheder: 0,
      boern: 0,
      pendling: 0,
    },
  },
  {
    id: "pendler",
    navn: "Pendler",
    beskrivelse: "Kort vej til arbejde og mange job",
    ikon: IconCar,
    vaegte: {
      pendling: 100,
      jobmuligheder: 90,
      indbyggertal: 70,
      boligpriser: 60,
      kommuneskat: 50,
      spisesteder: 40,
      tryghed: 40,
      sundhed: 40,
      boern: 30,
      natur: 30,
      idraet: 30,
    },
  },
  {
    id: "foerstegangskoeber",
    navn: "Førstegangskøber",
    beskrivelse: "Lave boligpriser, job og byliv",
    ikon: IconKey,
    vaegte: {
      boligpriser: 100,
      jobmuligheder: 80,
      pendling: 70,
      spisesteder: 60,
      indbyggertal: 60,
      kommuneskat: 50,
      tryghed: 40,
      idraet: 40,
      natur: 30,
      sundhed: 30,
      boern: 20,
    },
  },
  {
    id: "storbyliv",
    navn: "Storbyliv",
    beskrivelse: "Spisesteder, job og mange mennesker",
    ikon: IconBuildingSkyscraper,
    vaegte: {
      spisesteder: 100,
      indbyggertal: 90,
      jobmuligheder: 80,
      pendling: 60,
      tryghed: 40,
      kommuneskat: 40,
      sundhed: 40,
      boligpriser: 30,
      idraet: 20,
      natur: 10,
      boern: 0,
    },
    // Tætheden skelner byer fra store landkommuner med mange indbyggere.
    noegletal: { indbyggertal: ["antal", "taethed"] },
  },
  {
    id: "landliv",
    navn: "Landliv og ro",
    beskrivelse: "Natur, billige huse og tryghed",
    ikon: IconTrees,
    vaegte: {
      natur: 100,
      boligpriser: 90,
      tryghed: 90,
      kommuneskat: 70,
      boern: 50,
      idraet: 50,
      sundhed: 40,
      jobmuligheder: 30,
      spisesteder: 10,
      indbyggertal: 0,
      pendling: 0,
    },
    // Natur pr. indbygger trækker de tyndt befolkede kommuner frem.
    noegletal: { boligpriser: ["hus"], natur: ["andel", "pr-indbygger"] },
  },
  {
    id: "laveste-udgifter",
    navn: "Laveste udgifter",
    beskrivelse: "Billig bolig, lav skat og børnepasning",
    ikon: IconPigMoney,
    vaegte: {
      boligpriser: 100,
      kommuneskat: 100,
      boern: 60,
      pendling: 40,
      jobmuligheder: 30,
      tryghed: 30,
      natur: 20,
      sundhed: 20,
      idraet: 20,
      spisesteder: 0,
      indbyggertal: 0,
    },
  },
];

// Det tal, der står ved en kategori under Styrker og Fokusområder på kommunekortene
// (efter kategoriens slug). Kun nøgletal, der tæller under Prioritet og har en værdi,
// kan vises; valgte man fx kun ejerlejligheder, vises lejlighedsprisen. Er der flere,
// vises kommunens bedste under Styrker og dens svageste under Fokusområder, mens boksen
// for den valgte kommune på kortet viser dem alle, så kommunerne kan sammenlignes. Kategorier,
// der ikke står her, viser deres første nøgletal med enheden fra databasen.
// noegletal er nøgletallets navn i databasen; v er værdien, allerede formateret.
type KortNoegletal = { noegletal: string; tekst: (v: string) => string };
const KORT_NOEGLETAL: Record<string, KortNoegletal[]> = {
  indbyggertal: [
    { noegletal: "Indbyggere", tekst: (v) => `${v} indbyggere` },
    { noegletal: "Indbyggere pr. km²", tekst: (v) => `${v} pr. km²` },
  ],
  boern: [{ noegletal: "Gennemsnitspris årligt", tekst: (v) => `${v} kr./år i snit` }],
  // Ikke ledigheden: en lav ledighed ved siden af "Svagere end landsgennemsnittet" (fordi der
  // er få job) ser ud som en modsigelse.
  jobmuligheder: [
    { noegletal: "Job pr. 1.000 indbyggere", tekst: (v) => `${v} job pr. 1.000 indb.` },
  ],
  spisesteder: [
    { noegletal: "Spisesteder pr. 1.000 indbyggere", tekst: (v) => `${v} pr. 1.000 indb.` },
    { noegletal: "Spisesteder i alt", tekst: (v) => `${v} i alt` },
  ],
  boligpriser: [
    { noegletal: "Parcel-/rækkehus", tekst: (v) => `${v} kr./m² (hus)` },
    { noegletal: "Ejerlejlighed", tekst: (v) => `${v} kr./m² (lejl.)` },
  ],
  kommuneskat: [
    { noegletal: "Kommuneskat", tekst: (v) => `${v} % i skat` },
    { noegletal: "Grundskyldspromille", tekst: (v) => `${v} ‰ grundskyld` },
  ],
  tryghed: [
    {
      noegletal: "Anmeldte forbrydelser pr. 1.000 indbyggere",
      tekst: (v) => `${v} anmeldelser pr. 1.000 indb.`,
    },
  ],
  natur: [
    { noegletal: "Andel natur og grønne områder", tekst: (v) => `${v} % natur` },
    { noegletal: "Natur pr. indbygger", tekst: (v) => `${v} m² natur pr. indb.` },
  ],
  pendling: [
    { noegletal: "Pendlingsafstand", tekst: (v) => `${v} km til arbejde` },
    { noegletal: AFSTAND_NOEGLETAL, tekst: (v) => `${v} km til din adresse` },
  ],
  sundhed: [
    { noegletal: "Middellevetid", tekst: (v) => `${v} års levetid` },
    { noegletal: "Afstand til nærmeste læge", tekst: (v) => `${v} km til læge` },
  ],
  idraet: [
    { noegletal: "Medlemskaber af idrætsforeninger", tekst: (v) => `${v} % i idrætsforening` },
    { noegletal: "Idrætsanlæg pr. 10.000 indbyggere", tekst: (v) => `${v} anlæg pr. 10.000 indb.` },
  ],
};

type Visning = "kort" | "oversigt" | "regneark";

// Sidepanelets sortering: samlet score, navn eller en enkelt kategoris score ("kat-<id>").
type SortFelt = "score" | "navn" | "favoritter" | `kat-${number}`;
type SortRetning = "stigende" | "faldende";

// Let, forenklet udgave til kortet (laves af scripts/byg-kortgraenser.ts); den fulde
// kommuner.geojson bruges kun på serveren.
const KOMMUNER_URL = "/data/kommuner-kort.geojson";

// Kommunegrænserne (ca. 1 MB) hentes én gang og deles af alle kortets kilder.
// Hentningen starter, før kortet er klar, og browseren har fået et preload-hint i
// <head>, så den kan begynde allerede mens sidens JavaScript hentes.
let kommunerData: Promise<GeoJSON.FeatureCollection> | null = null;
function hentKommuner() {
  kommunerData ??= fetch(KOMMUNER_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Kunne ikke hente kommunegrænser (${res.status})`);
      return res.json() as Promise<GeoJSON.FeatureCollection>;
    })
    .catch((fejl) => {
      kommunerData = null;
      throw fejl;
    });
  return kommunerData;
}

const SOURCE_ID = "kommuner";
const LINJE_SOURCE_ID = "kommune-linjer";
// Hver kommune opdelt i sine enkelte polygoner (fastland og øer), så hover-omridset
// kan springe øer over, der er for små på skærmen.
const KOMMUNE_DELE_SOURCE_ID = "kommune-dele";
// Kommunenavne: én tekst pr. kommune, vist fra dette zoomniveau.
const NAVNE_SOURCE_ID = "kommune-navne";
const NAVNE_MIN_ZOOM = 7.5;
// En ø skal fylde mindst så mange skærmpixels for at få hover-omrids.
const HOVER_OMRIDS_MIN_PIXELS = 40;

// Kommunens udstrækning som [[minLon, minLat], [maxLon, maxLat]].
function kommuneUdstraekning(geometri: GeoJSON.Geometry): [[number, number], [number, number]] {
  const polygoner =
    geometri.type === "Polygon"
      ? [geometri.coordinates]
      : geometri.type === "MultiPolygon"
        ? geometri.coordinates
        : [];
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  polygoner.forEach((polygon) =>
    polygon[0].forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }),
  );
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

function opdelIKommuneDele(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const dele: GeoJSON.Feature[] = [];
  data.features.forEach((feature) => {
    const kode = feature.properties?.kode as string;
    const geometri = feature.geometry;
    const polygoner =
      geometri.type === "Polygon"
        ? [geometri.coordinates]
        : geometri.type === "MultiPolygon"
          ? geometri.coordinates
          : [];
    polygoner.forEach((polygon) => {
      dele.push({
        type: "Feature",
        properties: { kode, areal: polygonArealKm2(polygon[0]) },
        geometry: { type: "Polygon", coordinates: polygon },
      });
    });
  });
  return { type: "FeatureCollection", features: dele };
}

// Ét punkt pr. kommune midt i dens største landdel, så navnet står én gang (på
// fastlandet) og ikke på hver ø. Et punkt og ikke selve polygonen: MapLibre deler
// GeoJSON op i fliser og sætter ellers et navn i hver flise, når man zoomer ind.
function kommuneNavnePunkter(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const stoerste = new Map<string, GeoJSON.Feature>();
  for (const del of opdelIKommuneDele(data).features) {
    const kode = del.properties?.kode as string;
    const nuvaerende = stoerste.get(kode);
    if (!nuvaerende || del.properties!.areal > nuvaerende.properties!.areal) {
      stoerste.set(kode, del);
    }
  }
  const navnPrKode = new Map(
    data.features.map((f) => [f.properties?.kode as string, f.properties?.navn as string]),
  );
  return {
    type: "FeatureCollection",
    features: [...stoerste.values()].map((del) => ({
      type: "Feature",
      properties: { ...del.properties, navn: navnPrKode.get(del.properties?.kode as string) },
      geometry: {
        type: "Point",
        coordinates: navnePunkt((del.geometry as GeoJSON.Polygon).coordinates),
      },
    })),
  };
}

// Det tykke omrids vises om kommunen under musen og den valgte kommune, men kun for
// dele, der ved det aktuelle zoomniveau fylder mindst HOVER_OMRIDS_MIN_PIXELS.
// En pixel dækker ca. 43,8 km / 2^zoom på dansk breddegrad.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapLibre style-expression typing is too deep to model here.
function byggHoverOmridsSynlighed(): any {
  const synligVed = (zoom: number) => {
    const kmPrPixel = 43.8 / 2 ** zoom;
    return [
      "case",
      [
        "all",
        [
          "any",
          ["boolean", ["feature-state", "hover"], false],
          ["boolean", ["feature-state", "valgt"], false],
        ],
        [">=", ["get", "areal"], HOVER_OMRIDS_MIN_PIXELS * kmPrPixel ** 2],
      ],
      1,
      0,
    ];
  };
  const zoomTrin = Array.from({ length: 16 }, (_, i) => i + 1);
  return ["step", ["zoom"], synligVed(0), ...zoomTrin.flatMap((z) => [z, synligVed(z)])];
}

// Score-farveskalaer på kortet: alle har 12 trin. Standard går fra rød til grøn;
// Lilla er en sammenhængende OKLCH-rampe fra lys til mørk i sidens accent-nuance (hue 295).
// Viridis er læselig ved alle typer farveblindhed; den er vendt, så mørkere betyder højere
// score ligesom i Lilla.
const KORT_FARVE_VALGT = "#4b5563";
type KortPaletId = "groen-gul-orange" | "lilla" | "viridis";
const KORT_PALETTER: Record<KortPaletId, { navn: string; farver: readonly string[] }> = {
  "groen-gul-orange": {
    navn: "Standard",
    farver: [
      "#a6011c", // 1 – laveste (rød)
      "#b5472d",
      "#c46735",
      "#d4873e",
      "#e7ab48",
      "#ffd453",
      "#fde763", // 7 – gul
      "#d7d95f",
      "#b0cc5d",
      "#86c05a",
      "#54b558",
      "#00ab57", // 12 – højeste (grøn)
    ],
  },
  viridis: {
    navn: "Viridis",
    farver: [
      "#fde725", // 1 – laveste (gul)
      "#c2df23",
      "#86d549",
      "#52c569",
      "#2ab07f",
      "#1e9b8a",
      "#25858e",
      "#2d708e",
      "#38588c",
      "#433e85",
      "#482173",
      "#440154", // 12 – højeste (mørk lilla)
    ],
  },
  lilla: {
    navn: "Lilla",
    farver: [
      "#dcd7f0", // 1 – laveste
      "#ccc3ef",
      "#bdafec",
      "#af9ce8",
      "#a188e3",
      "#9375dc",
      "#8562d3",
      "#774ec8",
      "#6a3bbb",
      "#5d28ac",
      "#4f1699",
      "#410185", // 12 – højeste
    ],
  },
};
const KORT_PALET_STANDARD: KortPaletId = "groen-gul-orange";
// Skæringspunkter, der deler 50-100 i lige så mange lige store score-intervaller,
// som paletten har farver.
function kortScoreTaerskler(antalFarver: number) {
  return Array.from(
    { length: antalFarver - 1 },
    (_, i) => 50 + ((i + 1) * 50) / antalFarver,
  );
}

// Den samlede score er et vægtet gennemsnit, så kommunerne ligger tæt (typisk 10-20 point).
// Farveskalaen strækkes derfor over de viste kommuners faktiske spænd i stedet for 50-100.
// Er spændet under FARVESKALA_MIN_SPAEND, udvides det om midten, så små forskelle (fx når
// filtret kun viser få kommuner) ikke ser store ud.
const FARVESKALA_MIN_SPAEND = 10;
type FarveSkala = { fra: number; til: number };
function byggFarveSkala(scorer: number[]): FarveSkala {
  if (scorer.length === 0) return { fra: 50, til: 100 };
  let fra = Math.min(...scorer);
  let til = Math.max(...scorer);
  const mangler = FARVESKALA_MIN_SPAEND - (til - fra);
  if (mangler > 0) {
    fra -= mangler / 2;
    til += mangler / 2;
    // Hold skalaen inden for 50-100 ved at skubbe den ind fra kanten.
    if (fra < 50) [fra, til] = [50, til + (50 - fra)];
    if (til > 100) [fra, til] = [fra - (til - 100), 100];
  }
  return { fra, til };
}

// En scores placering (0-100 %) på farveskalaen.
function scoreTilProcent(score: number, skala: FarveSkala) {
  return Math.min(100, Math.max(0, ((score - skala.fra) / (skala.til - skala.fra)) * 100));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapLibre style-expression typing is too deep to model here.
function byggKommuneFyldFarve(farver: readonly string[]): any {
  const taerskler = kortScoreTaerskler(farver.length);
  return [
    "case",
    ["boolean", ["feature-state", "valgt"], false],
    KORT_FARVE_VALGT,
    ["boolean", ["feature-state", "udenforFilter"], false],
    LAND_FARVE,
    ["boolean", ["feature-state", "ingenData"], false],
    LAND_FARVE,
    [
      "step",
      ["coalesce", ["feature-state", "score"], taerskler[0]],
      farver[0],
      ...taerskler.flatMap((taerskel, i) => [taerskel, farver[i + 1]]),
    ],
  ];
}

const DANMARK_BOUNDS: [[number, number], [number, number]] = [
  [7.8, 54.5],
  [15.3, 57.9],
];

// Zoom til de valgte områder i Område-filtret: lidt luft om kanten, og aldrig
// tættere på end zoom 8, så en enkelt lille landsdel ikke fylder hele kortet.
const FILTER_ZOOM_INDSTILLINGER = {
  padding: 48,
  maxZoom: 8,
  duration: 800,
};

// Vis hele Danmark og lås kortet til netop det udsnit: man kan zoome ind og panorere
// rundt, men aldrig zoome ud eller flytte sig længere væk end startvisningen. Kaldes
// igen, når kortet skifter størrelse, da udsnittet afhænger af kortets bredde og højde.
function laasKortTilDanmark(map: MapLibreMap) {
  map.setMaxBounds(null);
  map.setMinZoom(0);
  map.fitBounds(DANMARK_BOUNDS, { padding: 24, duration: 0 });
  map.setMinZoom(map.getZoom());
  map.setMaxBounds(map.getBounds());
}

// Tyskland, Sverige, Norge og Polen (Natural Earth 1:10m, klippet til kortets udsnit).
// Rent baggrundslag: ingen hændelser er bundet til det, så landene kan ikke klikkes.
const NABOLANDE_URL = "/data/nabolande.geojson";
// Neutral landfarve til nabolandene og til kommuner, der er valgt fra i filtrene.
const LAND_FARVE = "#e8e5d9";

const KORT_STYLE: StyleSpecification = {
  version: 8,
  // Skrifttype til kommunenavnene (OpenMapTiles' fri fontserver, Open Sans).
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  sources: {
    nabolande: { type: "geojson", data: NABOLANDE_URL },
  },
  layers: [
    {
      id: "hav",
      type: "background",
      paint: { "background-color": "#90c1de" },
    },
    {
      id: "nabolande",
      type: "fill",
      source: "nabolande",
      paint: { "fill-color": LAND_FARVE },
    },
  ],
};

function RegionAfkrydsning() {
  return (
    <Dropdown.ItemIndicator className="shrink-0">
      {({ isSelected }) => (
        <span
          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150 ${
            isSelected ? "border-accent bg-accent" : "border-border bg-surface"
          }`}
        >
          {isSelected && <IconCheck className="h-3 w-3 text-white" />}
        </span>
      )}
    </Dropdown.ItemIndicator>
  );
}

// "Læs mere" nederst i infoboksene. Åbner i en ny fane, så kortet og ens valg bevares.
function LaesMere({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
    >
      Læs mere
      <IconArrowRight className="h-3 w-3" />
    </a>
  );
}

// Infoboksen til venstre for Prioritet-panelet. Den ligger inde i panelet (ikke som en
// tooltip i body), fordi panelet er modalt: alt uden for det er inert, og et klik
// udenfor lukker det. Så kan man føre musen hen til boksen og klikke på "Læs mere".
type PanelInfoId = "prioritet" | number;
const PANEL_INFO_ID = "prioritet-info";
const PANEL_INFO_VIS_FORSINKELSE = 150;
// Tid til at føre musen fra ?-ikonet over panelet og ind i boksen.
const PANEL_INFO_LUK_FORSINKELSE = 400;

function usePanelInfo() {
  const [aktiv, setAktiv] = useState<PanelInfoId | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const annuller = () => clearTimeout(timer.current);
  const skjulSnart = () => {
    annuller();
    timer.current = setTimeout(() => setAktiv(null), PANEL_INFO_LUK_FORSINKELSE);
  };
  const luk = () => {
    annuller();
    setAktiv(null);
  };

  const knapProps = (id: PanelInfoId) => ({
    "aria-expanded": aktiv === id,
    "aria-controls": aktiv === id ? PANEL_INFO_ID : undefined,
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "touch") return;
      annuller();
      // Er en boks allerede åben, skiftes der med det samme.
      timer.current = setTimeout(() => setAktiv(id), aktiv === null ? PANEL_INFO_VIS_FORSINKELSE : 0);
    },
    onPointerLeave: skjulSnart,
    onFocus: () => {
      annuller();
      setAktiv(id);
    },
    onBlur: skjulSnart,
    // Til touch; boksen lukker igen, når man trykker et andet sted.
    onClick: () => {
      annuller();
      setAktiv(id);
    },
  });

  const boksProps = {
    id: PANEL_INFO_ID,
    onPointerEnter: annuller,
    onPointerLeave: skjulSnart,
    onFocus: annuller,
    onBlur: skjulSnart,
  };

  return { aktiv, knapProps, boksProps, luk };
}

function InfoKnap({ label, ...props }: { label: string } & ReturnType<ReturnType<typeof usePanelInfo>["knapProps"]>) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground ${
        props["aria-expanded"] ? "bg-surface-secondary text-foreground" : "text-muted"
      }`}
    >
      <IconHelpCircle className="h-4 w-4" />
    </button>
  );
}

function PrioritetInfoIndhold() {
  return (
    <>
      <p className="text-sm font-medium text-foreground">Vægt pr. kategori</p>
      <p className="mt-1.5 text-sm text-pretty text-muted">
        Justér, hvor vigtig hver kategori er for dig. En højere vægt
        betyder, at kommunernes score i den pågældende kategori får større
        betydning for den samlede rangering. Det ændrer ikke kommunernes
        score, men kun hvordan de vægtes og sorteres.
      </p>
      <LaesMere href="/saadan-virker-det#beregning" />
    </>
  );
}

function ScoreInfo({ farvEfterPlacering }: { farvEfterPlacering: boolean }) {
  return (
    <Tooltip delay={150}>
      <Tooltip.Trigger aria-label="Hvordan beregnes scoren?">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:text-foreground">
          <IconHelpCircle className="h-3.5 w-3.5" />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content
        showArrow
        placement="bottom"
        shouldFlip={false}
        className="w-72 break-normal"
      >
        <Tooltip.Arrow />
        <div className="flex flex-col gap-2 text-sm text-pretty">
          <p>
            Hver kommune får en score fra 50 til 100 i hver kategori. Den samlede score er et
            gennemsnit af kategorierne, vægtet efter din <strong>Prioritet</strong>.
          </p>
          <p>
            <strong>Prioritet</strong> ændrer vægtene og dermed den samlede score. Fravælger du en
            kategori, tæller den slet ikke med.
          </p>
          <p>
            <strong>Område</strong> ændrer ikke scoren, men hvilke kommuner der er med. Spændet og placeringerne gælder kun de viste kommuner.
          </p>
          <p>Søgefeltet påvirker hverken score eller spænd.</p>
          {farvEfterPlacering ? (
            <p>
              <strong>Farverne</strong> viser placering: hver farve dækker lige mange af de viste
              kommuner, fra de laveste (rød) til de bedste (grøn). Tallet på kommunen er stadig
              selve scoren.
            </p>
          ) : (
            <p>
              <strong>Farverne</strong> strækkes over de viste kommuners spænd, så forskellene
              kan ses, selvom scorerne ligger tæt. Skalaen dækker dog mindst{" "}
              {FARVESKALA_MIN_SPAEND} point.
            </p>
          )}
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}

/** Kategoriens valg fra NOEGLETAL_VALG, som den har nøgletal til (fx er "Min adresse" i
 * Pendling der kun, når man har skrevet en adresse), eller undefined når der ikke er
 * mindst to at vælge imellem. */
function noegletalValgFor(kat: KategoriMeta): NoegletalValg[] | undefined {
  const valg = (NOEGLETAL_VALG[kat.slug] ?? []).filter((v) =>
    kat.noegletal.some((n) => n.navn === v.noegletal),
  );
  return valg.length > 1 ? valg : undefined;
}

function erGennemsnit(navn: string) {
  return navn.toLowerCase().includes("gennemsnit");
}

function KategoriInfoIndhold({ kategori }: { kategori: KategoriMeta }) {
  const gennemsnit = kategori.noegletal.find((n) => erGennemsnit(n.navn));
  const restNoegletal = gennemsnit
    ? kategori.noegletal.filter((n) => n !== gennemsnit)
    : kategori.noegletal;

  return (
    <>
      <p className="text-sm font-medium text-foreground">
        {gennemsnit
          ? `${kategori.navn} dækker ${gennemsnit.navn.toLowerCase()} for:`
          : `${kategori.navn} dækker over:`}
      </p>
      {restNoegletal.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1.5 text-sm text-pretty text-muted">
          {restNoegletal.map((n) => (
            <li key={n.navn}>
              · {n.navn}
              {n.beskrivelse && (
                <span className="mt-0.5 block pl-2.5 text-xs">{n.beskrivelse}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-pretty text-muted">
          Ingen nøgletal oprettet endnu.
        </p>
      )}
      {/* Med en adresse står afstanden til den som nøgletal i listen ovenfor. */}
      {kategori.slug === PENDLING_SLUG &&
        !kategori.noegletal.some((n) => n.navn === AFSTAND_NOEGLETAL) && (
          <ul className="mt-1.5 flex flex-col gap-1.5 text-sm text-pretty text-muted">
            <li>
              · Min adresse
              <span className="mt-0.5 block pl-2.5 text-xs">
                Skriv din arbejdsplads i feltet for at se afstanden i fugleflugt fra hver kommunes
                største by. Så tæller den i stedet for gennemsnittet. Adressen gemmes kun i din
                browser.
              </span>
            </li>
          </ul>
        )}
      <LaesMere href={`/kilder#${kategori.slug}`} />
    </>
  );
}

// Vælger under Prioritet for kategorier i NOEGLETAL_VALG, fx Parcel/Rækkehus og Ejerlejlighed i
// Boligpriser. Mindst ét nøgletal skal være valgt.
function NoegletalVaelger({
  kategori,
  valg,
  valgteIder,
  aktiv,
  antalUdenData,
  onVaelg,
}: {
  kategori: KategoriMeta;
  valg: NoegletalValg[];
  valgteIder: string[];
  aktiv: boolean;
  antalUdenData: number;
  onVaelg: (ider: string[]) => void;
}) {
  return (
    <div className={`flex flex-col gap-1.5 transition-opacity duration-150 ${aktiv ? "" : "opacity-40"}`}>
      <ToggleButtonGroup
        aria-label={`Hvad tæller i ${kategori.navn}?`}
        size="sm"
        fullWidth
        selectionMode="multiple"
        disallowEmptySelection
        isDisabled={!aktiv}
        selectedKeys={valgteIder}
        onSelectionChange={(keys) => onVaelg([...keys].map(String))}
      >
        {valg.map((v, i) => (
          // Mindre end standard "sm", så vælgeren ikke fylder mere end slideren over den.
          <ToggleButton key={v.id} id={v.id} className="h-6 min-h-0 px-2 text-xs">
            {i > 0 && <ToggleButtonGroup.Separator />}
            <span title={v.forklaring}>{v.label}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {antalUdenData > 0 && (
        <p className="text-[11px] leading-snug text-muted">
          {antalUdenData} {antalUdenData === 1 ? "kommune" : "kommuner"} har for få handler til en
          pris; {kategori.navn} tæller ikke med for dem.
        </p>
      )}
    </div>
  );
}

function GruppeInfo({ beskrivelse }: { beskrivelse: string }) {
  return (
    <Tooltip delay={150}>
      <Tooltip.Trigger aria-label="Hvad betyder gruppen?">
        <span
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground"
        >
          <IconHelpCircle className="h-3.5 w-3.5" />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content
        showArrow
        placement="right"
        shouldFlip={false}
        className="w-64 break-normal"
      >
        <Tooltip.Arrow />
        <p className="text-sm text-pretty">{beskrivelse}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

// "Fuldskærm"-knap på kortet: skjuler kun kommunelisten til venstre, så kortet fylder
// hele bredden (ikke browserens fuldskærm). Bruger MapLibres egne fuldskærmsikoner.
class SidepanelKontrol implements IControl {
  private container = document.createElement("div");
  private knap = document.createElement("button");

  constructor(onToggle: () => void) {
    // Listen findes kun på store skærme, så knappen gør det også.
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group max-lg:hidden";
    this.knap.type = "button";
    this.knap.innerHTML = '<span class="maplibregl-ctrl-icon" aria-hidden="true"></span>';
    this.knap.addEventListener("click", onToggle);
    this.container.appendChild(this.knap);
    this.setUdvidet(false);
  }

  setUdvidet(udvidet: boolean) {
    this.knap.className = udvidet ? "maplibregl-ctrl-shrink" : "maplibregl-ctrl-fullscreen";
    const label = udvidet ? "Vis kommunelisten" : "Skjul kommunelisten";
    this.knap.title = label;
    this.knap.setAttribute("aria-label", label);
    this.knap.setAttribute("aria-pressed", String(udvidet));
  }

  onAdd() {
    return this.container;
  }

  onRemove() {
    this.container.remove();
  }
}

function rankFarve(rank: number) {
  if (rank === 1) return "bg-gradient-to-br from-yellow-300 to-yellow-600 text-yellow-950";
  if (rank === 2) return "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900";
  if (rank === 3) return "bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950";
  return "bg-foreground text-surface";
}

// Har kommunen intet foto (eller fejler det), vises et hus-ikon i stedet.
function KommuneBillede({
  kode,
  navn,
  harBillede,
  ikonClassName,
}: {
  kode: string;
  navn: string;
  harBillede: boolean;
  ikonClassName: string;
}) {
  const [fejlet, setFejlet] = useState(false);

  if (!harBillede || fejlet) {
    return <IconHome className={ikonClassName} />;
  }

  return (
    <img
      src={`/kommuner/${kode}.jpg`}
      alt={navn}
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setFejlet(true)}
    />
  );
}

/** Tæller på knappens hjørne. Absolut placeret, så knappen ikke skifter bredde
 * (og dens åbne popover ikke flytter sig), når tælleren dukker op eller forsvinder. */
function FilterBadge({ antal }: { antal: number }) {
  return (
    <span className="pointer-events-none absolute -top-1.5 -right-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-medium text-accent-foreground ring-2 ring-background tabular-nums">
      {antal}
    </span>
  );
}

// null: kommunen har ingen data i de kategorier, der tæller med lige nu.
function ScoreBadge({ score }: { score: number | null }) {
  const rundet = score === null ? "–" : Math.round(score);

  return (
    <div
      title={score === null ? "Ingen data for det valgte" : `Score: ${rundet} ud af 100`}
      className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary px-2 text-sm font-bold tabular-nums text-foreground ring-1 ring-inset ring-border/50"
    >
      {rundet}
    </div>
  );
}

// Kolonneoverskrift i Regneark, der sorterer tabellen ved klik.
function SorterbarOverskrift({
  felt,
  label,
  ikon,
  sortFelt,
  sortRetning,
  onSorter,
  hoejre = false,
  inaktiv = false,
}: {
  felt: SortFelt;
  label: string;
  ikon?: string | null;
  sortFelt: SortFelt;
  sortRetning: SortRetning;
  onSorter: (felt: SortFelt) => void;
  hoejre?: boolean;
  inaktiv?: boolean;
}) {
  const aktiv = felt === sortFelt;
  const SortIkon = sortRetning === "stigende" ? IconSortAscending : IconSortDescending;

  return (
    <th
      aria-sort={aktiv ? (sortRetning === "stigende" ? "ascending" : "descending") : "none"}
      className="px-4 py-3 font-medium"
    >
      <button
        type="button"
        onClick={() => onSorter(felt)}
        title={inaktiv ? `${label} (slået fra under Prioritet)` : `Sortér efter ${label}`}
        className={`items-center gap-1.5 rounded-md transition-colors duration-150 hover:text-foreground ${
          hoejre ? "ml-auto flex" : "inline-flex"
        } ${aktiv ? "text-foreground" : ""} ${inaktiv ? "opacity-50" : ""}`}
      >
        {ikon && <KategoriIkon navn={ikon} className="h-4 w-4 shrink-0" />}
        {label}
        <SortIkon className={`h-3.5 w-3.5 shrink-0 ${aktiv ? "" : "invisible"}`} />
      </button>
    </th>
  );
}

// Bredde for værktøjslinjen og Oversigt/Regneark. Kortet går fuld bredde på store skærme.
const INDHOLD_BREDDE = "mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8";

const VISNINGER:{ id: Visning; label: string; Ikon: () => React.JSX.Element }[] = [
  { id: "kort", label: "Kort", Ikon: () => <IconMap className="h-4 w-4" /> },
  { id: "oversigt", label: "Oversigt", Ikon: () => <IconLayoutGrid className="h-4 w-4" /> },
  { id: "regneark", label: "Regneark", Ikon: () => <IconLayoutColumns className="h-4 w-4" /> },
];

// Kommunekortet i Oversigt og i sidepanelet ved siden af kortet.
function ProfilKolonne({
  titel,
  Ikon,
  farve,
  punkter,
  noegletalTekst,
  className = "",
}: {
  titel: string;
  Ikon: typeof IconTarget;
  farve: string;
  punkter: ProfilPunkt[];
  noegletalTekst: (kat: KategoriMeta) => string | null;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${farve}`}>
        <Ikon className="h-4 w-4 shrink-0" />
        {titel}
      </p>
      {punkter.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {punkter.map((p) => {
            const tal = noegletalTekst(p.kategori);
            return (
              <li key={p.kategori.id} className="flex items-start gap-2">
                <KategoriIkon
                  navn={p.kategori.ikon}
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words hyphens-auto text-foreground">
                    {p.kategori.navn}
                  </p>
                  {tal && (
                    <p className="text-xs leading-snug font-medium tabular-nums break-words text-foreground">
                      {tal}
                    </p>
                  )}
                  <p className="text-xs leading-snug break-words hyphens-auto text-muted">{p.tekst}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">–</p>
      )}
    </div>
  );
}

// Én kategori i boksen for den valgte kommune på kortet. score er null, når kommunen
// ikke har data for de valgte nøgletal; aktiv = tæller med under Prioritet lige nu.
type ValgtKategori = {
  kategori: KategoriMeta;
  score: number | null;
  gennemsnit: number | null;
  tal: string | null;
  aktiv: boolean;
};

// Kategorierne for den valgte kommune: score som bjælke (50-100) med landsgennemsnittet
// som streg, og tallet bag. Kategorier, der ikke tæller med, står nedtonet til sidst.
function ValgtKommuneKategorier({ raekker }: { raekker: ValgtKategori[] }) {
  const procent = (v: number) => Math.min(100, Math.max(0, ((v - 50) / 50) * 100));

  return (
    <ul className="flex flex-col gap-3 border-t border-border p-3.5">
      {raekker.map(({ kategori, score, gennemsnit, tal, aktiv }) => (
        <li
          key={kategori.id}
          className={aktiv ? "" : "opacity-45"}
          title={aktiv ? undefined : "Tæller ikke med under Prioritet"}
        >
          <div className="flex items-center gap-2">
            <KategoriIkon navn={kategori.ikon} className="h-4 w-4 shrink-0 text-muted" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {kategori.navn}
            </p>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {score === null ? "–" : Math.round(score)}
            </span>
          </div>
          <div className="relative mt-1.5 h-1.5 rounded-full bg-surface-secondary">
            {score !== null && (
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(2, procent(score))}%` }}
              />
            )}
            {gennemsnit !== null && (
              <div
                className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-foreground/60"
                style={{ left: `calc(${procent(gennemsnit)}% - 1px)` }}
                title={`Landsgennemsnit ${Math.round(gennemsnit)}`}
              />
            )}
          </div>
          {tal && <p className="mt-1 text-xs tabular-nums text-muted">{tal}</p>}
        </li>
      ))}
    </ul>
  );
}

// Forklaring til stregen på kategoriernes bjælker, vist nederst i boksen over rapportlinket.
function GennemsnitForklaring() {
  return (
    <p className="flex items-center justify-center gap-1.5 border-t border-border px-3.5 py-2 text-xs text-muted">
      <span aria-hidden className="h-2.5 w-0.5 rounded-full bg-foreground/60" />
      Landsgennemsnit
    </p>
  );
}

// Åbner kommunens rapport (/kommune/[navn], fx /kommune/aarhus) i en ny fane, så kortet og ens valg bevares.
function RapportLink({ navn }: { navn: string }) {
  return (
    <a
      href={`/kommune/${kommuneSlug(navn)}`}
      target="_blank"
      rel="noopener"
      className="flex w-full items-center justify-center gap-1.5 border-t border-border bg-accent/10 py-2.5 text-xs font-medium text-accent transition-colors duration-200 hover:bg-accent/20"
    >
      <IconFileText className="h-3.5 w-3.5" />
      Se fuld rapport
    </a>
  );
}

// Hjertet øverst til højre på kommunekortene. Hvid rund baggrund, så det kan ses på
// både lyse og mørke billeder.
function FavoritKnap({
  navn,
  favorit,
  onSkift,
  className = "",
}: {
  navn: string;
  favorit: boolean;
  onSkift: () => void;
  className?: string;
}) {
  const Ikon = favorit ? IconHeartFilled : IconHeart;
  return (
    <button
      type="button"
      onClick={onSkift}
      aria-pressed={favorit}
      aria-label={favorit ? `Fjern ${navn} fra favoritter` : `Tilføj ${navn} til favoritter`}
      title={favorit ? "Fjern fra favoritter" : "Tilføj til favoritter"}
      className={`z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform duration-150 hover:scale-110 ${
        favorit ? "text-red-500" : "text-gray-600 hover:text-red-500"
      } ${className}`}
    >
      <Ikon className="h-4.5 w-4.5" />
    </button>
  );
}

function KommuneKort({
  kommune: k,
  rang,
  score,
  valgt = false,
  profil,
  noegletalTekst,
  lavtBillede = false,
  harBillede,
  favorit,
  onFavorit,
  onVaelg,
}: {
  kommune: Kommune;
  rang: number;
  score: number | null;
  valgt?: boolean;
  harBillede: boolean;
  profil?: KommuneProfil;
  // Tallet ved en kategori i Styrker (styrke = true) og Fokusområder, fx "18.400 kr./m² (hus)".
  noegletalTekst: (kat: KategoriMeta, styrke: boolean) => string | null;
  // Lidt lavere billede i sidepanelet, så de øverste tre kort kan ses hele.
  lavtBillede?: boolean;
  favorit: boolean;
  onFavorit: (k: Kommune) => void;
  onVaelg: (k: Kommune) => void;
}) {
  return (
    <div
      data-kode={k.kode}
      className={`@container relative flex shrink-0 flex-col overflow-hidden rounded-2xl border bg-surface transition-all duration-200 hover:-translate-y-1 hover:shadow-sm ${
        valgt ? "border-accent ring-2 ring-accent/40" : "border-border"
      }`}
    >
      {/* Uden for kortets knap, da en knap ikke må ligge inde i en anden. */}
      <FavoritKnap
        navn={k.navn}
        favorit={favorit}
        onSkift={() => onFavorit(k)}
        className="absolute right-2 top-2"
      />
      <button type="button" onClick={() => onVaelg(k)} className="flex flex-1 flex-col justify-start text-left">
        <div
          className={`relative flex ${lavtBillede ? "h-24" : "h-28"} items-center justify-center bg-gradient-to-br from-surface-secondary to-accent/10`}
        >
          <KommuneBillede
            kode={k.kode}
            navn={k.navn}
            harBillede={harBillede}
            ikonClassName="h-8 w-8 text-muted/50"
          />
          <span
            className={`absolute -bottom-4 left-3 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-md ring-4 ring-surface ${rankFarve(
              rang,
            )}`}
          >
            {rang}.
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 p-3.5 pl-16">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{k.navn}</p>
            <p className="mt-0.5 text-xs text-muted">
              {REGION_NAVNE[k.regionskode] ?? "Ukendt region"}
            </p>
          </div>
          <ScoreBadge score={score} />
        </div>

        {profil && (profil.styrker.length > 0 || profil.fokus.length > 0) && (
          // Er kortet smalt (fx i sidepanelet på mindre skærme), står Styrker og
          // Fokusområder under hinanden, så ordene ikke brydes midt over.
          <div className="mx-3.5 grid grid-cols-1 gap-3 border-t border-border py-3 @xs:grid-cols-2">
            <ProfilKolonne
              titel="Styrker"
              Ikon={IconTrendingUp}
              farve="text-success"
              punkter={profil.styrker}
              noegletalTekst={(kat) => noegletalTekst(kat, true)}
            />
            <ProfilKolonne
              className="border-t border-border pt-3 @xs:border-t-0 @xs:border-l @xs:pt-0 @xs:pl-3"
              titel="Fokusområder"
              Ikon={IconTarget}
              farve="text-accent"
              punkter={profil.fokus}
              noegletalTekst={(kat) => noegletalTekst(kat, false)}
            />
          </div>
        )}
      </button>

      <RapportLink navn={k.navn} />
    </div>
  );
}

// Sidepanelet viser kommunerne i bidder, så listen ikke bliver uendelig lang.
const SIDEPANEL_BID = 10;
// Oversigt viser kortene i et gitter med 2, 3 eller 4 kolonner; 12 går op i dem alle.
const OVERSIGT_BID = 12;

function VisFlere({
  vist,
  ialt,
  bid,
  onVisFlere,
}: {
  vist: number;
  ialt: number;
  bid: number;
  onVisFlere: () => void;
}) {
  if (ialt <= vist) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-xs text-muted">
        Viser <span className="font-semibold tabular-nums text-foreground">{vist}</span> af {ialt}
      </p>
      <Button
        variant="outline"
        className="h-10 w-full gap-1.5 rounded-lg text-sm"
        onPress={onVisFlere}
      >
        <IconChevronsDown className="h-4 w-4" />
        Vis {Math.min(bid, ialt - vist)} mere
      </Button>
    </div>
  );
}

export function DanmarkKort({
  kategorier: databaseKategorier,
  kommuneScores: databaseScorer,
  kommunerMedBillede,
}: {
  kategorier: KategoriMeta[];
  kommuneScores: KommuneScore[];
  kommunerMedBillede: string[];
}) {
  // Skal matche fetch() i hentKommuner (cors, samme-origin-cookies), ellers genbruges den ikke.
  preload(KOMMUNER_URL, { as: "fetch", crossOrigin: "anonymous" });
  // Med en adresse i Pendling får kategorien et ekstra nøgletal for afstanden til den.
  const [minAdresse, setMinAdresse] = useState<Adresse | null>(null);
  // kategoriId -> valgte id'er fra NOEGLETAL_VALG; mangler den, er alle valgt.
  const [noegletalValg, setNoegletalValg] = useState<Record<number, string[]>>({});
  const pendlingId = databaseKategorier.find((k) => k.slug === PENDLING_SLUG)?.id;
  // Vælger man en adresse, tæller afstanden til den i stedet for gennemsnittet; fjerner
  // man den, tæller gennemsnittet igen.
  const vaelgAdresse = (adresse: Adresse | null, gem = true) => {
    setMinAdresse(adresse);
    if (pendlingId !== undefined) {
      setNoegletalValg((valg) => {
        const nyt = { ...valg };
        if (adresse) nyt[pendlingId] = [AFSTAND_VALG_ID];
        else delete nyt[pendlingId];
        return nyt;
      });
    }
    if (!gem) return;
    try {
      if (adresse) localStorage.setItem(ADRESSE_LAGER, JSON.stringify(adresse));
      else localStorage.removeItem(ADRESSE_LAGER);
    } catch {}
  };
  useEffect(() => {
    try {
      const gemt = localStorage.getItem(ADRESSE_LAGER);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage findes kun i browseren.
      if (gemt) vaelgAdresse(JSON.parse(gemt), false);
    } catch {}
    // Kun ved første visning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const kategorier = useMemo(
    () =>
      minAdresse
        ? databaseKategorier.map((k) => (k.slug === PENDLING_SLUG ? medAfstandsNoegletal(k, minAdresse) : k))
        : databaseKategorier,
    [minAdresse, databaseKategorier],
  );
  const kommuneScores = useMemo(
    () => (minAdresse ? medAfstand(databaseScorer, minAdresse) : databaseScorer),
    [minAdresse, databaseScorer],
  );

  const billedKoder = useMemo(() => new Set(kommunerMedBillede), [kommunerMedBillede]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredKode = useRef<string | null>(null);
  const valgtKodeRef = useRef<string | null>(null);
  const soegRef = useRef<HTMLDivElement | null>(null);
  const valgteRegionerRef = useRef<Selection>(new Set<string>());
  const valgteGrupperRef = useRef<Selection>(new Set<string>());
  const kommuneRegionerRef = useRef<Map<string, string>>(new Map());
  const kommuneUdstraekningRef = useRef<Map<string, [[number, number], [number, number]]>>(
    new Map(),
  );
  const farvePaletIdRef = useRef<KortPaletId>(KORT_PALET_STANDARD);
  const museOverAktivRef = useRef(true);

  const [kommuner, setKommuner] = useState<Kommune[]>([]);
  const [valgtKode, setValgtKode] = useState<string | null>(null);
  const [soegning, setSoegning] = useState("");
  const [forslagAabent, setForslagAabent] = useState(false);
  const [klar, setKlar] = useState(false);
  const [visning, setVisning] = useState<Visning>("kort");
  const [sidepanelSkjult, setSidepanelSkjult] = useState(false);
  const [zoomIkonPladser, setZoomIkonPladser] = useState<{
    ind: HTMLElement;
    ud: HTMLElement;
  } | null>(null);
  const sidepanelKontrolRef = useRef<SidepanelKontrol | null>(null);
  const [sortFelt, setSortFelt] = useState<SortFelt>("score");
  const [sortRetning, setSortRetning] = useState<SortRetning>("faldende");
  const { favoritter, skiftFavorit, delLink, fraLink } = useFavoritter(kommuneScores);
  // Sidepanelet viser kun favoritterne. Indtil brugeren selv vælger, er det slået til,
  // hvis siden blev åbnet fra et delt link.
  const [kunFavoritterValg, setKunFavoritter] = useState<boolean | null>(null);
  const kunFavoritter = kunFavoritterValg ?? fraLink;
  const [linkKopieret, setLinkKopieret] = useState(false);
  // "Vis flere" gælder én bestemt søgning/filtrering/sortering (listeNoegle nedenfor);
  // ændres den, starter listen forfra med første bid.
  const [visFlere, setVisFlere] = useState({ noegle: "", antal: SIDEPANEL_BID });
  // Oversigt har sin egen "Vis flere", så de to visninger ikke påvirker hinanden.
  const [oversigtVisFlere, setOversigtVisFlere] = useState({ noegle: "", antal: OVERSIGT_BID });
  const visningRef = useRef<Visning>(visning);
  // Samlet udstrækning af kommunerne i det aktive Område-filter (null = intet filter).
  const filterUdstraekningRef = useRef<[[number, number], [number, number]] | null>(null);
  const filterNoegleRef = useRef("");
  const [valgteRegioner, setValgteRegioner] = useState<Selection>(new Set<string>());
  const [valgteGrupper, setValgteGrupper] = useState<Selection>(new Set<string>());
  const [prioriteter, setPrioriteter] = useState<Record<number, number>>(() =>
    Object.fromEntries(kategorier.map((k) => [k.id, PRIORITET_STANDARD])),
  );
  const [aktiveKategorier, setAktiveKategorier] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(kategorier.map((k) => [k.id, true])),
  );

  // Infoboksen ved Prioritet: undefined = lukket, null = om vægtene, ellers en kategori.
  const panelInfo = usePanelInfo();
  const panelInfoKategori =
    panelInfo.aktiv === null
      ? undefined
      : panelInfo.aktiv === "prioritet"
        ? null
        : kategorier.find((k) => k.id === panelInfo.aktiv);

  // Valgene fra start: dem, hvis nøgletal tæller i standardscoren (tilvalg som
  // befolkningstæthed er ikke med). Er ingen standardvalgt, er alle valgt, som på serveren.
  const standardIder = (kat: KategoriMeta) => {
    const valg = noegletalValgFor(kat) ?? [];
    const valgte = valg.filter(
      (v) => kat.noegletal.find((n) => n.navn === v.noegletal)?.standardValgt !== false,
    );
    return (valgte.length > 0 ? valgte : valg).map((v) => v.id);
  };

  const valgteIder = (kat: KategoriMeta) => noegletalValg[kat.id] ?? standardIder(kat);

  // Id'er på de nøgletal, der tæller i kategorien, eller undefined når valget er som fra
  // start, så kategorien tæller som normalt (serverens kategoriscore).
  const valgteNoegletalIder = (kat: KategoriMeta) => {
    const valg = noegletalValgFor(kat);
    if (!valg) return undefined;
    const ider = valgteIder(kat);
    const standard = standardIder(kat);
    if (ider.length === standard.length && standard.every((id) => ider.includes(id))) {
      return undefined;
    }
    return valg
      .filter((v) => ider.includes(v.id))
      .flatMap((v) => kat.noegletal.find((n) => n.navn === v.noegletal)?.id ?? []);
  };
  const [farvePaletId, setFarvePaletId] = useState<KortPaletId>(KORT_PALET_STANDARD);
  const [museOverAktiv, setMuseOverAktiv] = useState(true);
  const [klikFremhaevAktiv, setKlikFremhaevAktiv] = useState(false);
  // Test: farv kommunerne efter placering (kvantiler) i stedet for fast skala 50-100.
  const [farvEfterPlacering, setFarvEfterPlacering] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const kommunerPromise = hentKommuner();
    let fjernet = false;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: KORT_STYLE,
      bounds: DANMARK_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
    });

    laasKortTilDanmark(map);
    // Når kortet ændrer størrelse (vindue, eller kommunelisten skjules/vises), låses det
    // til det nye udsnit; et aktivt Område-filter zoomes der ind på igen.
    // map.resize() udløser også hændelsen uden ændret størrelse; det springes over.
    let forrigeStoerrelse = `${map.getCanvas().clientWidth}x${map.getCanvas().clientHeight}`;
    map.on("resize", () => {
      const stoerrelse = `${map.getCanvas().clientWidth}x${map.getCanvas().clientHeight}`;
      if (stoerrelse === forrigeStoerrelse) return;
      forrigeStoerrelse = stoerrelse;
      laasKortTilDanmark(map);
      if (filterUdstraekningRef.current) {
        map.fitBounds(filterUdstraekningRef.current, { ...FILTER_ZOOM_INDSTILLINGER, duration: 0 });
      }
    });
    map.doubleClickZoom.disable();
    // Kortet skal altid vende nord op og ligge fladt: slå rotation og hældning fra
    // (højreklik-træk, to-finger-rotation og Shift+piletaster).
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.keyboard.disableRotation();

    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    // Zoomknapperne beholder MapLibres opførsel, men ikonerne byttes til Tabler (via portal).
    const zoomInd = map.getContainer().querySelector<HTMLElement>(
      ".maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon",
    );
    const zoomUd = map.getContainer().querySelector<HTMLElement>(
      ".maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon",
    );
    if (zoomInd && zoomUd) setZoomIkonPladser({ ind: zoomInd, ud: zoomUd });
    // Nederste hjørner stabler nye kontroller ovenpå, så knappen lander over zoom.
    const sidepanelKontrol = new SidepanelKontrol(() => setSidepanelSkjult((s) => !s));
    sidepanelKontrolRef.current = sidepanelKontrol;
    map.addControl(sidepanelKontrol, "bottom-right");

    map.on("load", async () => {
      const data = await kommunerPromise;
      if (fjernet) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data,
        promoteId: "kode",
        tolerance: 0,
        buffer: 256,
      });

      map.addLayer({
        id: "kommune-fill",
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": byggKommuneFyldFarve(KORT_PALETTER[farvePaletIdRef.current].farver),
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "valgt"], false],
            0.55,
            ["boolean", ["feature-state", "udenforFilter"], false],
            1,
            0.9,
          ],
        },
      });

      map.setPaintProperty("kommune-fill", "fill-opacity-transition", {
        duration: 400,
        delay: 0,
      });
      map.setPaintProperty("kommune-fill", "fill-color-transition", {
        duration: 400,
        delay: 0,
      });

      // De tynde grænser tegnes fra en forenklet kopi af kommunerne: ved lav zoom
      // klumper takkede kyster (fx Bornholms nordkyst) sig ellers sammen, så stregen
      // ser tykkere ud. Forenklingen følger zoom, så detaljerne kommer igen tæt på.
      map.addSource(LINJE_SOURCE_ID, {
        type: "geojson",
        data,
        tolerance: 0.5,
        buffer: 256,
      });

      map.addLayer({
        id: "kommune-linje",
        type: "line",
        source: LINJE_SOURCE_ID,
        layout: { "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 1,
        },
      });

      // Fremhæv ved mus: kun et tykkere hvidt omrids om kommunen under musen.
      // Eget lag øverst, så nabokommunernes tynde linjer ikke tegnes hen over det.
      // Kilden fyldes, når kommunerne er hentet nedenfor.
      map.addSource(KOMMUNE_DELE_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "kode",
        tolerance: 0,
        buffer: 256,
      });

      map.addLayer({
        id: "kommune-hover-linje",
        type: "line",
        source: KOMMUNE_DELE_SOURCE_ID,
        layout: { "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 3,
          "line-opacity": byggHoverOmridsSynlighed(),
        },
      });

      (map.getSource(KOMMUNE_DELE_SOURCE_ID) as GeoJSONSource).setData(opdelIKommuneDele(data));

      // Kommunenavne vises først, når man zoomer ind, og kun hvor de kan være uden
      // at overlappe hinanden (MapLibre skjuler automatisk dem, der ikke er plads til).
      map.addSource(NAVNE_SOURCE_ID, { type: "geojson", data: kommuneNavnePunkter(data) });
      map.addLayer({
        id: "kommune-navne",
        type: "symbol",
        source: NAVNE_SOURCE_ID,
        minzoom: NAVNE_MIN_ZOOM,
        layout: {
          "text-field": ["get", "navn"],
          "text-font": ["Open Sans Semibold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], NAVNE_MIN_ZOOM, 11, 10, 15],
          "text-max-width": 8,
          "text-padding": 4,
        },
        paint: {
          "text-color": "#1f2937",
          "text-halo-color": "rgba(255, 255, 255, 0.85)",
          "text-halo-width": 1.5,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], NAVNE_MIN_ZOOM, 0, NAVNE_MIN_ZOOM + 0.3, 1],
        },
      });

      const liste: Kommune[] = [];
      data.features.forEach((feature) => {
        const kode = feature.properties?.kode as string;
        const navn = feature.properties?.navn as string;
        const regionskode = feature.properties?.regionskode as string;
        liste.push({ kode, navn, regionskode });
        kommuneUdstraekningRef.current.set(kode, kommuneUdstraekning(feature.geometry));
      });
      liste.sort((a, b) => a.navn.localeCompare(b.navn, "da"));
      setKommuner(liste);
      kommuneRegionerRef.current = new Map(liste.map((k) => [k.kode, k.regionskode]));

      setKlar(true);
    });

    const erKommuneTilladt = (kode: string) => {
      const valgteOmr = valgteRegionerRef.current;
      const omrFilterAktiv = valgteOmr !== "all" && valgteOmr.size > 0;
      if (omrFilterAktiv) {
        const regionskode = kommuneRegionerRef.current.get(kode);
        if (regionskode) {
          let matcher = false;
          for (const id of valgteOmr) {
            if (kommuneMatcherFilterId(kode, regionskode, String(id))) {
              matcher = true;
              break;
            }
          }
          if (!matcher) return false;
        }
      }

      const valgteGrp = valgteGrupperRef.current;
      const grpFilterAktiv = valgteGrp !== "all" && valgteGrp.size > 0;
      if (grpFilterAktiv) {
        let matcher = false;
        for (const id of valgteGrp) {
          if (kommuneMatcherGruppeId(kode, String(id))) {
            matcher = true;
            break;
          }
        }
        if (!matcher) return false;
      }

      return true;
    };

    map.on("mousemove", "kommune-fill", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const kode = feature.properties?.kode as string;

      if (!erKommuneTilladt(kode)) {
        map.getCanvas().style.cursor = "";
        if (hoveredKode.current) {
          map.setFeatureState(
            { source: KOMMUNE_DELE_SOURCE_ID, id: hoveredKode.current },
            { hover: false },
          );
          hoveredKode.current = null;
        }
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      if (!museOverAktivRef.current) return;

      if (hoveredKode.current && hoveredKode.current !== kode) {
        map.setFeatureState(
          { source: KOMMUNE_DELE_SOURCE_ID, id: hoveredKode.current },
          { hover: false },
        );
      }
      if (hoveredKode.current !== kode) {
        map.setFeatureState({ source: KOMMUNE_DELE_SOURCE_ID, id: kode }, { hover: true });
        hoveredKode.current = kode;
      }
    });

    map.on("mouseleave", "kommune-fill", () => {
      map.getCanvas().style.cursor = "";
      if (hoveredKode.current) {
        map.setFeatureState(
          { source: KOMMUNE_DELE_SOURCE_ID, id: hoveredKode.current },
          { hover: false },
        );
        hoveredKode.current = null;
      }
    });

    map.on("click", "kommune-fill", (e) => {
      const feature = e.features?.[0];
      const kode = feature?.properties?.kode as string | undefined;
      if (!kode || !erKommuneTilladt(kode)) return;
      setValgtKode(kode);
    });

    mapRef.current = map;

    return () => {
      fjernet = true;
      setZoomIkonPladser(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !klar) return;

    if (valgtKodeRef.current && valgtKodeRef.current !== valgtKode) {
      map.setFeatureState(
        { source: SOURCE_ID, id: valgtKodeRef.current },
        { valgt: false },
      );
      map.setFeatureState(
        { source: KOMMUNE_DELE_SOURCE_ID, id: valgtKodeRef.current },
        { valgt: false },
      );
      valgtKodeRef.current = null;
    }

    if (valgtKode) {
      map.setFeatureState(
        { source: SOURCE_ID, id: valgtKode },
        { valgt: klikFremhaevAktiv },
      );
      // Den valgte kommune får altid det tykke hvide omrids, uanset hvordan den er valgt.
      map.setFeatureState({ source: KOMMUNE_DELE_SOURCE_ID, id: valgtKode }, { valgt: true });
      valgtKodeRef.current = valgtKode;
    }
  }, [valgtKode, klikFremhaevAktiv, klar]);

  useEffect(() => {
    valgteRegionerRef.current = valgteRegioner;
    valgteGrupperRef.current = valgteGrupper;

    const map = mapRef.current;
    if (!map || !klar) return;

    const omrFilterAktiv = valgteRegioner !== "all" && valgteRegioner.size > 0;
    const omrIds = omrFilterAktiv ? [...valgteRegioner].map(String) : [];

    const grpFilterAktiv = valgteGrupper !== "all" && valgteGrupper.size > 0;
    const grpIds = grpFilterAktiv ? [...valgteGrupper].map(String) : [];

    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    kommuner.forEach((k) => {
      const matcherOmr =
        !omrFilterAktiv ||
        omrIds.some((id) => kommuneMatcherFilterId(k.kode, k.regionskode, id));
      const matcherGrp =
        !grpFilterAktiv || grpIds.some((id) => kommuneMatcherGruppeId(k.kode, id));
      map.setFeatureState(
        { source: SOURCE_ID, id: k.kode },
        { udenforFilter: !(matcherOmr && matcherGrp) },
      );

      const udstraekning = kommuneUdstraekningRef.current.get(k.kode);
      if (matcherOmr && matcherGrp && udstraekning) {
        minX = Math.min(minX, udstraekning[0][0]);
        minY = Math.min(minY, udstraekning[0][1]);
        maxX = Math.max(maxX, udstraekning[1][0]);
        maxY = Math.max(maxY, udstraekning[1][1]);
      }
    });

    const filterAktivt = (omrFilterAktiv || grpFilterAktiv) && minX !== Infinity;
    filterUdstraekningRef.current = filterAktivt
      ? [
          [minX, minY],
          [maxX, maxY],
        ]
      : null;

    // Zoom ind på de valgte områder, når filtret ændres. Udstrækningen dækker alle
    // valgte områder, så fx Nordjylland + Hovedstaden centreres med begge synlige.
    const noegle = JSON.stringify([omrIds, grpIds]);
    if (noegle === filterNoegleRef.current) return;
    filterNoegleRef.current = noegle;
    if (visningRef.current !== "kort") return;
    if (filterUdstraekningRef.current) {
      map.fitBounds(filterUdstraekningRef.current, FILTER_ZOOM_INDSTILLINGER);
    } else {
      map.fitBounds(DANMARK_BOUNDS, { padding: 24, duration: 800 });
    }
  }, [valgteRegioner, valgteGrupper, klar, kommuner]);

  const forsteRegionsRender = useRef(true);

  useEffect(() => {
    if (forsteRegionsRender.current) {
      forsteRegionsRender.current = false;
      return;
    }

    setValgtKode(null);
    setSoegning("");
  }, [valgteRegioner, valgteGrupper]);

  useEffect(() => {
    farvePaletIdRef.current = farvePaletId;

    const map = mapRef.current;
    if (!map || !klar) return;

    map.setPaintProperty(
      "kommune-fill",
      "fill-color",
      byggKommuneFyldFarve(KORT_PALETTER[farvePaletId].farver),
    );
  }, [farvePaletId, klar]);

  useEffect(() => {
    museOverAktivRef.current = museOverAktiv;
    if (museOverAktiv) return;

    const map = mapRef.current;
    if (!map || !hoveredKode.current) return;

    map.setFeatureState(
      { source: KOMMUNE_DELE_SOURCE_ID, id: hoveredKode.current },
      { hover: false },
    );
    hoveredKode.current = null;
  }, [museOverAktiv]);

  useEffect(() => {
    sidepanelKontrolRef.current?.setUdvidet(sidepanelSkjult);
    // Kortet skifter bredde, når listen skjules eller vises.
    mapRef.current?.resize();
  }, [sidepanelSkjult]);

  // I Kort-visning skjules footeren, så kortet fylder skærmen uden scroll.
  useEffect(() => {
    const html = document.documentElement;
    if (visning === "kort") html.dataset.kortVisning = "";
    else delete html.dataset.kortVisning;
    if (visning === "oversigt" || visning === "regneark") html.dataset.laastVisning = "";
    else delete html.dataset.laastVisning;
    return () => {
      delete html.dataset.kortVisning;
      delete html.dataset.laastVisning;
    };
  }, [visning]);

  useEffect(() => {
    visningRef.current = visning;
    const map = mapRef.current;
    if (!map || visning !== "kort" || !klar) return;

    map.resize();

    if (!valgtKode) {
      laasKortTilDanmark(map);
      if (filterUdstraekningRef.current) {
        map.fitBounds(filterUdstraekningRef.current, { ...FILTER_ZOOM_INDSTILLINGER, duration: 0 });
      }
    }
  }, [visning, klar]);

  useEffect(() => {
    const lukVedKlikUdenfor = (e: MouseEvent) => {
      if (soegRef.current && !soegRef.current.contains(e.target as Node)) {
        setForslagAabent(false);
      }
    };
    document.addEventListener("mousedown", lukVedKlikUdenfor);
    return () => document.removeEventListener("mousedown", lukVedKlikUdenfor);
  }, []);

  const regionFilterAktiv = valgteRegioner !== "all" && valgteRegioner.size > 0;
  const gruppeFilterAktiv = valgteGrupper !== "all" && valgteGrupper.size > 0;

  const nulstilPrioriteter = () => {
    setPrioriteter(Object.fromEntries(kategorier.map((k) => [k.id, PRIORITET_STANDARD])));
    setAktiveKategorier(Object.fromEntries(kategorier.map((k) => [k.id, true])));
    setNoegletalValg({});
  };
  const antalAendredePrioriteter = kategorier.filter(
    (k) =>
      (prioriteter[k.id] ?? PRIORITET_STANDARD) !== PRIORITET_STANDARD ||
      !(aktiveKategorier[k.id] ?? true) ||
      valgteNoegletalIder(k) !== undefined,
  ).length;
  const antalAktiveKategorier = kategorier.filter((k) => aktiveKategorier[k.id] ?? true).length;

  // Kategoriens andel af den samlede score i procent: dens vægt delt med summen af de
  // aktive kategoriers vægte, som i vaegtetScore. Vises ved hver kategori under Prioritet,
  // så man kan se, hvor meget en vægt reelt betyder, når der er mange kategorier.
  const samletAktivVaegt = kategorier.reduce(
    (sum, k) =>
      aktiveKategorier[k.id] === false ? sum : sum + (prioriteter[k.id] ?? PRIORITET_STANDARD),
    0,
  );
  const andelAfScore = (kat: KategoriMeta) =>
    aktiveKategorier[kat.id] === false || samletAktivVaegt === 0
      ? 0
      : ((prioriteter[kat.id] ?? PRIORITET_STANDARD) / samletAktivVaegt) * 100;

  const vaelgProfil = (profil: Profil) => {
    setPrioriteter(
      Object.fromEntries(
        kategorier.map((k) => [k.id, profil.vaegte[k.slug] ?? PRIORITET_STANDARD]),
      ),
    );
    setAktiveKategorier(Object.fromEntries(kategorier.map((k) => [k.id, true])));
    setNoegletalValg(
      Object.fromEntries(
        kategorier.flatMap((k) => (profil.noegletal?.[k.slug] ? [[k.id, profil.noegletal[k.slug]]] : [])),
      ),
    );
  };

  // Profilen, som Prioritet står på lige nu; ændrer man en vægt bagefter, er ingen valgt.
  const samme = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id) => b.includes(id));
  const aktivProfil = PROFILER.find((profil) =>
    kategorier.every(
      (k) =>
        (aktiveKategorier[k.id] ?? true) &&
        (prioriteter[k.id] ?? PRIORITET_STANDARD) ===
          (profil.vaegte[k.slug] ?? PRIORITET_STANDARD) &&
        samme(
          valgteIder(k),
          profil.noegletal?.[k.slug] ?? standardIder(k),
        ),
    ),
  );

  const matcherRegion = (k: Kommune) =>
    !regionFilterAktiv ||
    [...valgteRegioner].some((id) =>
      kommuneMatcherFilterId(k.kode, k.regionskode, String(id)),
    );

  const matcherGruppe = (k: Kommune) =>
    !gruppeFilterAktiv ||
    [...valgteGrupper].some((id) => kommuneMatcherGruppeId(k.kode, String(id)));

  const matcherFiltre = (k: Kommune) => matcherRegion(k) && matcherGruppe(k);

  const kategoriScorerPrKommune = useMemo(
    () => new Map(kommuneScores.map((s) => [s.kode, s.kategorier])),
    [kommuneScores],
  );

  // Styrker og fokusområder er faste "highlights" for kommunen: de sammenlignes med
  // hele landet i alle kategorier og påvirkes hverken af filtre eller Prioritet.
  const kommuneProfiler = useMemo(() => {
    const fordelinger = byggKategoriFordelinger(kategorier, kommuneScores);
    return new Map(
      kommuneScores.map((s) => [s.kode, byggKommuneProfil(kategorier, fordelinger, s.kategorier)]),
    );
  }, [kategorier, kommuneScores]);

  const noegletalScorerPrKommune = useMemo(
    () => new Map(kommuneScores.map((s) => [s.kode, s.noegletal])),
    [kommuneScores],
  );

  const vaerdierPrKommune = useMemo(
    () => new Map(kommuneScores.map((s) => [s.kode, s.vaerdier])),
    [kommuneScores],
  );

  // Tallet, der vises ved kategorien på kommunekortet (se KORT_NOEGLETAL). Har
  // kategorien flere nøgletal at vælge imellem, vises det, der forklarer placeringen:
  // kommunens bedste under Styrker og dens svageste under Fokusområder.
  // null = kommunen har ingen værdi at vise.
  // De nøgletal fra KORT_NOEGLETAL, som tæller under Prioritet og har en værdi for kommunen.
  const visbareNoegletal = (kode: string, kat: KategoriMeta) => {
    const vaerdier = vaerdierPrKommune.get(kode) ?? {};
    const talteIder = valgteNoegletalIder(kat);
    return (KORT_NOEGLETAL[kat.slug] ?? []).flatMap((valg) => {
      const noegletal = kat.noegletal.find((n) => n.navn === valg.noegletal);
      const id = noegletal?.id;
      if (id === undefined || vaerdier[id] === undefined) return [];
      if (talteIder && !talteIder.includes(id)) return [];
      // Valget er som fra start: tilvalg (fx befolkningstæthed) tæller ikke og vises ikke.
      if (!talteIder && noegletal?.standardValgt === false) return [];
      return [{ id, tekst: valg.tekst(formaterTal(vaerdier[id], 1)) }];
    });
  };

  // Reserve, når der ikke er et tal fra KORT_NOEGLETAL at vise. Er kun nogle af kategoriens
  // nøgletal valgt (fx kun ejerlejligheder), og mangler kommunen dem, siges det i stedet for
  // at vise et andet tal (fx husprisen), som ikke tæller med. Ellers: første nøgletal med
  // databasens enhed.
  const foersteNoegletalTekst = (kode: string, kat: KategoriMeta): string | null => {
    const valg = noegletalValgFor(kat);
    if (valg && valgteNoegletalIder(kat) !== undefined) {
      const valgte = valg.filter((v) => valgteIder(kat).includes(v.id));
      if (valgte.length === 0) return null;
      return `Ingen tal for ${valgte.map((v) => v.label.toLowerCase()).join(" og ")}`;
    }
    const vaerdier = vaerdierPrKommune.get(kode);
    if (!vaerdier) return null;
    const noegletal = kat.noegletal.find((n) => vaerdier[n.id] !== undefined);
    return noegletal ? `${formaterTal(vaerdier[noegletal.id], 1)} ${noegletal.enhed}` : null;
  };

  const noegletalTekst = (kode: string, kat: KategoriMeta, styrke: boolean): string | null => {
    const scorer = noegletalScorerPrKommune.get(kode) ?? {};
    let bedst: { id: number; tekst: string } | null = null;
    for (const n of visbareNoegletal(kode, kat)) {
      // Ved lige scorer vinder det første i KORT_NOEGLETAL.
      if (!bedst || (styrke ? scorer[n.id] > scorer[bedst.id] : scorer[n.id] < scorer[bedst.id])) {
        bedst = n;
      }
    }
    return bedst ? bedst.tekst : foersteNoegletalTekst(kode, kat);
  };

  // Alle kategoriens viste nøgletal (fx både hus og lejlighed), så kommunerne kan sammenlignes.
  const alleNoegletalTekst = (kode: string, kat: KategoriMeta): string | null => {
    const tekster = visbareNoegletal(kode, kat).map((n) => n.tekst);
    return tekster.length > 0 ? tekster.join(" · ") : foersteNoegletalTekst(kode, kat);
  };

  // Kommunens score i kategorien: gennemsnittet af de valgte nøgletal, som kommunen har
  // værdier for (ligesom kategoriscoren på serveren). null = ingen data for dem.
  const kategoriScore = (kode: string, kat: KategoriMeta): number | null => {
    const noegletalIder = valgteNoegletalIder(kat);
    if (noegletalIder === undefined) {
      return kategoriScorerPrKommune.get(kode)?.[kat.id] ?? PRIORITET_STANDARD;
    }
    const scorer = noegletalIder.flatMap((id) => noegletalScorerPrKommune.get(kode)?.[id] ?? []);
    return scorer.length > 0 ? scorer.reduce((a, b) => a + b, 0) / scorer.length : null;
  };

  // null når kommunen ikke har data i nogen af de kategorier, der tæller med.
  const vaegtetScore = (kode: string): number | null => {
    if (!kategoriScorerPrKommune.has(kode)) return PRIORITET_STANDARD;

    let sumVaegtetScore = 0;
    let sumVaegt = 0;
    let harVaegt = false;
    for (const kat of kategorier) {
      if (aktiveKategorier[kat.id] === false) continue;
      const vaegt = prioriteter[kat.id] ?? PRIORITET_STANDARD;
      if (vaegt <= 0) continue;
      harVaegt = true;
      const score = kategoriScore(kode, kat);
      if (score === null) continue;
      sumVaegtetScore += score * vaegt;
      sumVaegt += vaegt;
    }
    if (sumVaegt > 0) return sumVaegtetScore / sumVaegt;
    return harVaegt ? null : PRIORITET_STANDARD;
  };

  // Kommuner uden data sorteres sidst.
  const sammenlignScorer = (a: number | null, b: number | null) =>
    (b ?? -Infinity) - (a ?? -Infinity) || 0;

  const sorterEfterScore = (a: Kommune, b: Kommune) =>
    sammenlignScorer(vaegtetScore(a.kode), vaegtetScore(b.kode)) ||
    a.navn.localeCompare(b.navn, "da");


  const forslag = useMemo(() => {
    const q = soegning.trim().toLowerCase();
    if (!q) return [];
    return kommuner
      .filter((k) => matcherFiltre(k))
      .filter((k) => k.navn.toLowerCase().includes(q))
      .slice(0, 8);
  }, [kommuner, soegning, valgteRegioner, valgteGrupper]);

  const kommunerFiltreret = useMemo(() => {
    const q = soegning.trim().toLowerCase();
    return kommuner
      .filter((k) => matcherFiltre(k))
      .filter((k) => (q ? k.navn.toLowerCase().includes(q) : true))
      .sort(sorterEfterScore);
  }, [
    kommuner,
    soegning,
    valgteRegioner,
    valgteGrupper,
    kategoriScorerPrKommune,
    kategorier,
    prioriteter,
    aktiveKategorier,
    noegletalValg,
  ]);

  const kommunerRegionFiltreret = useMemo(
    () => kommuner.filter((k) => matcherFiltre(k)).sort(sorterEfterScore),
    [
      kommuner,
      valgteRegioner,
      valgteGrupper,
      kategoriScorerPrKommune,
      kategorier,
      prioriteter,
      aktiveKategorier,
      noegletalValg,
    ],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !klar) return;

    // Farvelagen forventer en "farvescore" på 50-100. Efter score strækkes de viste
    // kommuners spænd over hele paletten (se byggFarveSkala). Efter placering omsættes
    // placeringen, så palettens 12 trin hver dækker lige mange kommuner, uanset hvor tæt
    // scorerne ligger. Kommuner uden for filtret er grå alligevel.
    // Kommuner uden data tæller ikke med og farves grå.
    const medData = kommunerRegionFiltreret.filter((k) => vaegtetScore(k.kode) !== null);
    const antal = medData.length;
    const skala = byggFarveSkala(medData.map((k) => vaegtetScore(k.kode)!));
    const farveScore = (score: number) => {
      if (!farvEfterPlacering) return 50 + scoreTilProcent(score, skala) / 2;
      if (antal <= 1) return 100;
      // Lige scorer deler placering, så de også får samme farve.
      const bedreEnd = medData.filter((k) => vaegtetScore(k.kode)! > score).length;
      return 50 + (1 - bedreEnd / (antal - 1)) * 50;
    };

    kommuner.forEach((k) => {
      const score = vaegtetScore(k.kode);
      map.setFeatureState(
        { source: SOURCE_ID, id: k.kode },
        { score: score === null ? null : farveScore(score), ingenData: score === null },
      );
    });
  }, [
    klar,
    kommuner,
    kategoriScorerPrKommune,
    kategorier,
    prioriteter,
    aktiveKategorier,
    noegletalValg,
    farvEfterPlacering,
    valgteRegioner,
    valgteGrupper,
  ]);

  const sortFeltNavn = (felt: SortFelt) => {
    if (felt === "score") return "Samlet score";
    if (felt === "navn") return "Navn";
    if (felt === "favoritter") return "Favoritter først";
    const id = Number(felt.slice(4));
    return kategorier.find((kat) => kat.id === id)?.navn ?? "Kategori";
  };

  const vaelgSortFelt = (felt: SortFelt) => {
    setSortFelt(felt);
    // Navne læses naturligt A-Å, scorer med de bedste først.
    setSortRetning(felt === "navn" ? "stigende" : "faldende");
  };

  // Regnearkets overskrifter: ny kolonne sorteres som i sidepanelet, samme kolonne vender retningen.
  const sorterEfterKolonne = (felt: SortFelt) => {
    if (felt === sortFelt) {
      setSortRetning((r) => (r === "stigende" ? "faldende" : "stigende"));
    } else {
      vaelgSortFelt(felt);
    }
  };

  const sidepanelKommuner = useMemo(() => {
    const vaerdi = (k: Kommune) => {
      if (sortFelt === "score" || sortFelt === "favoritter") return vaegtetScore(k.kode);
      const id = Number(sortFelt.slice(4));
      const kat = kategorier.find((kat) => kat.id === id);
      return kat ? kategoriScore(k.kode, kat) : null;
    };
    // Placeringen er højeste score først og ved lige score A-Å. Faldende følger den
    // rækkefølge, og stigende vender den helt, så placeringstallene altid står i orden.
    // Kommuner uden data står sidst i begge retninger.
    const retning = sortRetning === "stigende" ? 1 : -1;
    const navnOrden = (a: Kommune, b: Kommune) => a.navn.localeCompare(b.navn, "da");
    return [...kommunerFiltreret].sort((a, b) => {
      if (sortFelt === "navn") return retning * navnOrden(a, b);
      // Favoritter først (i begge retninger); ellers efter samlet score.
      if (sortFelt === "favoritter") {
        const aFavorit = favoritter.includes(a.kode);
        if (aFavorit !== favoritter.includes(b.kode)) return aFavorit ? -1 : 1;
      }
      const va = vaerdi(a);
      const vb = vaerdi(b);
      if (va === null || vb === null) {
        return va === vb ? navnOrden(a, b) : va === null ? 1 : -1;
      }
      return retning * (va - vb) || -retning * navnOrden(a, b);
    });
  }, [kommunerFiltreret, sortFelt, sortRetning, kategoriScorerPrKommune, noegletalValg, favoritter]);

  // Listen i alle tre visninger. Placeringerne er stadig blandt alle kommuner i Område.
  const sidepanelListe = kunFavoritter
    ? sidepanelKommuner.filter((k) => favoritter.includes(k.kode))
    : sidepanelKommuner;

  const delFavoritter = async () => {
    const link = delLink();
    try {
      await navigator.clipboard.writeText(link);
      setLinkKopieret(true);
      setTimeout(() => setLinkKopieret(false), 2000);
    } catch {
      // Udklipsholderen kræver https og tilladelse; ellers kan linket kopieres herfra.
      window.prompt("Kopiér linket til dine favoritter:", link);
    }
  };

  // Ny søgning, filtrering eller sortering starter listen forfra med første bid.
  const noegleFor = (valg: Selection) => (valg === "all" ? "all" : [...valg].sort().join(","));
  const listeNoegle = [
    soegning,
    noegleFor(valgteRegioner),
    noegleFor(valgteGrupper),
    sortFelt,
    sortRetning,
  ].join("|");
  const sidepanelNoegle = `${listeNoegle}|${kunFavoritter}`;
  const antalVist = visFlere.noegle === sidepanelNoegle ? visFlere.antal : SIDEPANEL_BID;
  const oversigtAntalVist =
    oversigtVisFlere.noegle === sidepanelNoegle ? oversigtVisFlere.antal : OVERSIGT_BID;

  const rangAf = (kode: string) =>
    kommunerRegionFiltreret.findIndex((k) => k.kode === kode) + 1;

  // Laveste og højeste score blandt kommunerne i Område-filtret (listen er
  // sorteret med højeste score først).
  // Kommuner uden data er sorteret sidst og tæller ikke med.
  const scorerMedData = kommunerRegionFiltreret
    .map((k) => vaegtetScore(k.kode))
    .filter((s): s is number => s !== null);
  const scoreSpaend =
    scorerMedData.length > 0
      ? {
          hoejeste: Math.round(scorerMedData[0]),
          laveste: Math.round(scorerMedData.at(-1)!),
        }
      : null;
  // Samme skala som farvelagen på kortet.
  const farveSkala = byggFarveSkala(scorerMedData);

  const valgtKommune = kommuner.find((k) => k.kode === valgtKode) ?? null;
  const valgtKommuneRang = valgtKommune ? rangAf(valgtKommune.kode) : 0;

  // Kategorierne i boksen for den valgte kommune. De tæller med efter Prioritet: vigtigste
  // først, og kategorier, der er slået fra eller har vægt 0, nedtonet til sidst. Score,
  // gennemsnit og tal følger de valgte nøgletal (fx kun ejerlejligheder).
  const valgtKommuneKategorier: ValgtKategori[] = valgtKommune
    ? kategorier
        .map((kat) => {
          const score = kategoriScore(valgtKommune.kode, kat);
          const alle = kommuneScores.flatMap((s) => kategoriScore(s.kode, kat) ?? []);
          const gennemsnit = alle.length > 0 ? alle.reduce((a, b) => a + b, 0) / alle.length : null;
          const vaegt = prioriteter[kat.id] ?? PRIORITET_STANDARD;
          return {
            kategori: kat,
            score,
            gennemsnit,
            tal: alleNoegletalTekst(valgtKommune.kode, kat),
            aktiv: aktiveKategorier[kat.id] !== false && vaegt > 0,
            vaegt,
          };
        })
        .sort((a, b) => Number(b.aktiv) - Number(a.aktiv) || b.vaegt - a.vaegt)
    : [];

  // Fra søgeforslagene skrives navnet i søgefeltet; fra sidepanelet ikke, da søgningen
  // ellers ville filtrere listen ned til den ene kommune.
  const vaelgKommune = (k: Kommune, { udfyldSoegning = true } = {}) => {
    setValgtKode(k.kode);
    if (udfyldSoegning) setSoegning(k.navn);
    setForslagAabent(false);

    // Centrér kortet på kommunen. Ekstra luft til højre, hvor kommunekortet ligger.
    const map = mapRef.current;
    const udstraekning = kommuneUdstraekningRef.current.get(k.kode);
    if (map && udstraekning && visning === "kort") {
      const bred = map.getContainer().clientWidth >= 640;
      map.fitBounds(udstraekning, {
        padding: { top: 120, bottom: 120, left: 120, right: bred ? 400 : 120 },
        maxZoom: 8,
        duration: 800,
      });
    }
  };

  const vaelgFraSidepanel = (k: Kommune) => vaelgKommune(k, { udfyldSoegning: false });
  const vaelgFraOversigt = (k: Kommune) => setValgtKode(k.kode);

  const ingenKommuner = (
    <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted">
      {klar ? (
        <p>Ingen kommuner matcher.</p>
      ) : (
        <>
          <Spinner />
          <p>Indlæser kommuner…</p>
        </>
      )}
    </div>
  );

  const ingenKommunerEllerFavoritter =
    kunFavoritter && favoritter.length === 0 ? (
      <p className="col-span-full py-16 text-center text-sm text-muted">
        Du har ingen favoritter endnu. Tryk på{" "}
        <IconHeart className="inline h-4 w-4 align-text-bottom" aria-label="hjertet" /> på en
        kommune for at gemme den her.
      </p>
    ) : (
      ingenKommuner
    );

  // Sortering og favoritter over kommunelisten: i sidepanelet ved kortet, i Oversigt og
  // i Regneark (hvor kolonneoverskrifterne også sorterer).
  const listeVaerktoej = (
    <>
      <div className="flex items-center gap-1.5">
        <Dropdown>
          <Button
            variant="outline"
            // Må krympe, så der er plads til Favoritter-knapperne i det smalle panel.
            className="h-10 min-w-0 shrink gap-1.5 rounded-lg px-3 text-sm"
          >
            <span className="truncate">
              {/* "Sortér:" skjules i det smalle panel, så der er plads til knapperne. */}
              <span className="hidden text-muted @xs:inline">Sortér: </span>
              {sortFeltNavn(sortFelt)}
            </span>
            <IconChevronDown className="h-4 w-4 shrink-0" />
          </Button>
          <Dropdown.Popover className="min-w-[220px]">
            <Dropdown.Menu
              aria-label="Sortér efter"
              selectedKeys={new Set([sortFelt])}
              selectionMode="single"
              disallowEmptySelection
              onSelectionChange={(keys) => {
                const felt = keys === "all" ? undefined : [...keys][0];
                if (felt) vaelgSortFelt(String(felt) as SortFelt);
              }}
            >
              <Dropdown.Section>
                <Header>Sortér efter</Header>
                <Dropdown.Item id="score" textValue="Samlet score">
                  <Label>Samlet score</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
                <Dropdown.Item id="navn" textValue="Navn">
                  <Label>Navn</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
                <Dropdown.Item id="favoritter" textValue="Favoritter først">
                  <Label>Favoritter først</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              </Dropdown.Section>
              {kategorier.length > 0 && <Separator />}
              {kategorier.length > 0 && (
                <Dropdown.Section>
                  <Header>Kategori</Header>
                  {kategorier.map((kat) => (
                    <Dropdown.Item key={kat.id} id={`kat-${kat.id}`} textValue={kat.navn}>
                      <Label>{kat.navn}</Label>
                      <Dropdown.ItemIndicator />
                    </Dropdown.Item>
                  ))}
                </Dropdown.Section>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        <Button
          isIconOnly
          variant="outline"
          className="h-10 w-9 min-w-9 shrink-0 rounded-lg"
          aria-label={
            sortRetning === "stigende"
              ? "Sorteret stigende – vend til faldende"
              : "Sorteret faldende – vend til stigende"
          }
          onPress={() => setSortRetning((r) => (r === "stigende" ? "faldende" : "stigende"))}
        >
          {sortRetning === "stigende" ? (
            <IconSortAscending className="h-4 w-4" />
          ) : (
            <IconSortDescending className="h-4 w-4" />
          )}
        </Button>

        <Button
          isIconOnly
          variant={kunFavoritter ? "primary" : "outline"}
          className="relative h-10 w-9 min-w-9 shrink-0 rounded-lg"
          aria-pressed={kunFavoritter}
          aria-label={kunFavoritter ? "Vis alle kommuner" : "Vis kun favoritter"}
          onPress={() => setKunFavoritter(!kunFavoritter)}
        >
          {kunFavoritter ? (
            <IconHeartFilled className="h-4 w-4" />
          ) : (
            <IconHeart className="h-4 w-4" />
          )}
          {favoritter.length > 0 && <FilterBadge antal={favoritter.length} />}
        </Button>

        {/* Del-knappen vises kun sammen med favoritterne, så rækken ikke bliver for trang. */}
        {kunFavoritter && (
          <Button
            isIconOnly
            variant="outline"
            className="h-10 w-9 min-w-9 shrink-0 rounded-lg"
            isDisabled={favoritter.length === 0}
            aria-label={linkKopieret ? "Link kopieret" : "Del favoritter"}
            onPress={delFavoritter}
          >
            {linkKopieret ? (
              <IconCheck className="h-4 w-4 text-success" />
            ) : (
              <IconLink className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Vises kun, når søgning, filtre eller favoritter har skåret kommuner fra. */}
      {kommuner.length > 0 && sidepanelListe.length < kommuner.length && (
        <p className="mt-2 text-xs leading-tight text-muted" aria-live="polite">
          <span className="font-semibold text-foreground">{sidepanelListe.length}</span> ud af{" "}
          {kommuner.length} kommuner {kunFavoritter ? "blandt dine favoritter" : "fundet"}
        </p>
      )}
      {linkKopieret && (
        <p className="mt-2 text-xs text-success" role="status">
          Link til dine favoritter er kopieret.
        </p>
      )}
    </>
  );

  return (
    <div
      className={`flex flex-col ${
        visning === "kort"
          ? "gap-4 py-12 lg:h-[calc(100dvh-4.5rem-1px)] lg:gap-0 lg:py-0"
          : "gap-4 py-12 lg:min-h-0 lg:flex-1 lg:gap-0 lg:pt-0 lg:pb-6"
      }`}
    >
      <div
        className={`${INDHOLD_BREDDE} flex flex-wrap items-center gap-3 lg:py-3`}
      >
        <div ref={soegRef} className="relative w-full max-w-[240px]">
          <input
            type="search"
            value={soegning}
            onChange={(e) => {
              setSoegning(e.target.value);
              setForslagAabent(true);
            }}
            onFocus={() => setForslagAabent(true)}
            placeholder="Søg efter kommune"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-accent"
          />

          {visning === "kort" && forslagAabent && soegning.trim() !== "" && (
            <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-md">
              {forslag.map((k) => (
                <li key={k.kode}>
                  <button
                    type="button"
                    onClick={() => vaelgKommune(k)}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors duration-200 hover:bg-accent/10 ${
                      valgtKode === k.kode ? "font-medium text-foreground" : "text-muted"
                    }`}
                  >
                    {k.navn}
                  </button>
                </li>
              ))}

              {forslag.length === 0 && (
                <li className="px-4 py-2.5 text-sm text-muted">
                  {klar ? (
                    "Ingen kommuner matcher."
                  ) : (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" /> Indlæser kommuner…
                    </span>
                  )}
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-surface-secondary p-1">
          {VISNINGER.map(({ id, label, Ikon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setVisning(id);
                setSoegning("");
                setForslagAabent(false);
                setValgtKode(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ${
                visning === id
                  ? "bg-surface font-medium text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Ikon />
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Står til venstre for filtrene, så de ikke flytter sig, når den dukker op. */}
          {(regionFilterAktiv || gruppeFilterAktiv || antalAendredePrioriteter > 0) && (
            <Button
              variant="ghost"
              className="h-10 gap-1.5 rounded-lg text-sm"
              onPress={() => {
                setValgteRegioner(new Set<string>());
                setValgteGrupper(new Set<string>());
                nulstilPrioriteter();
              }}
            >
              <IconFilterOff className="h-4 w-4" />
              Nulstil filtre
            </Button>
          )}

          {/* Region/landsdel og kommunegruppe i én menu. De er stadig to filtre: inden for
              hvert tæller en kommune med, hvis den matcher et af valgene, og en kommune skal
              matche begge (fx landkommuner i Region Nordjylland). Gruppernes id'er får et
              præfiks i menuen, så de kan skilles fra regionerne igen. */}
          <Dropdown>
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-lg text-sm"
            >
              <IconWorldMap className="h-4 w-4" />
              Område
              {(regionFilterAktiv || gruppeFilterAktiv) && (
                <FilterBadge
                  antal={
                    (regionFilterAktiv ? valgteRegioner.size : 0) +
                    (gruppeFilterAktiv ? valgteGrupper.size : 0)
                  }
                />
              )}
            </Button>
            <Dropdown.Popover className="min-w-[260px]">
              <Dropdown.Menu
                selectedKeys={
                  new Set([
                    ...(valgteRegioner === "all" ? [] : [...valgteRegioner].map(String)),
                    ...(valgteGrupper === "all"
                      ? []
                      : [...valgteGrupper].map((id) => `${GRUPPE_PRAEFIKS}${id}`)),
                  ])
                }
                selectionMode="multiple"
                onSelectionChange={(valgte) => {
                  if (valgte === "all") return;
                  const ider = [...valgte].map(String);
                  setValgteRegioner(new Set(ider.filter((id) => !id.startsWith(GRUPPE_PRAEFIKS))));
                  setValgteGrupper(
                    new Set(
                      ider
                        .filter((id) => id.startsWith(GRUPPE_PRAEFIKS))
                        .map((id) => id.slice(GRUPPE_PRAEFIKS.length)),
                    ),
                  );
                }}
              >
                <Dropdown.Section>
                  <Header>Region</Header>
                  {Object.entries(REGION_NAVNE).map(([kode, navn]) => (
                    <Dropdown.Item key={kode} id={kode} textValue={navn}>
                      <RegionAfkrydsning />
                      <Label>{navn}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Section>
                <Separator />
                <Dropdown.Section>
                  <Header>Landsdel</Header>
                  {Object.entries(LANDSDEL_NAVNE).map(([id, navn]) => (
                    <Dropdown.Item key={id} id={id} textValue={navn}>
                      <RegionAfkrydsning />
                      <Label>{navn}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Section>
                <Separator />
                <Dropdown.Section>
                  <Header>Kommunetype</Header>
                  {Object.entries(GRUPPE_NAVNE).map(([id, navn]) => (
                    <Dropdown.Item
                      key={`${GRUPPE_PRAEFIKS}${id}`}
                      id={`${GRUPPE_PRAEFIKS}${id}`}
                      textValue={navn}
                    >
                      <RegionAfkrydsning />
                      <Label>{navn}</Label>
                      <GruppeInfo beskrivelse={GRUPPE_BESKRIVELSE[id]} />
                    </Dropdown.Item>
                  ))}
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {kategorier.length > 1 && (
            <Dropdown>
              <Button
                variant={aktivProfil ? "primary" : "outline"}
                className="h-10 gap-1.5 rounded-lg text-sm"
              >
                {aktivProfil ? (
                  <aktivProfil.ikon className="h-4 w-4" />
                ) : (
                  <IconUserCircle className="h-4 w-4" />
                )}
                {aktivProfil?.navn ?? "Profil"}
              </Button>
              <Dropdown.Popover className="w-84 max-w-[calc(100vw-2rem)]">
                <Dropdown.Menu
                  aria-label="Vælg en profil"
                  selectionMode="single"
                  selectedKeys={aktivProfil ? new Set([aktivProfil.id]) : new Set<string>()}
                  onSelectionChange={(valgte) => {
                    const id = valgte === "all" ? undefined : [...valgte][0];
                    const profil = PROFILER.find((p) => p.id === id);
                    if (profil) vaelgProfil(profil);
                  }}
                >
                  <Dropdown.Section>
                    <Header>Sæt Prioritet efter en profil</Header>
                    {PROFILER.map((profil) => (
                      // Blød baggrund i stedet for den kraftige fokusramme, som vises, så snart
                      // menuen åbner; tastaturfokus kan stadig ses.
                      <Dropdown.Item
                        key={profil.id}
                        id={profil.id}
                        textValue={profil.navn}
                        className="data-[focus-visible=true]:bg-default data-[focus-visible=true]:ring-0! data-[focus-visible=true]:ring-offset-0! focus-visible:bg-default focus-visible:ring-0! focus-visible:ring-offset-0!"
                      >
                        <div className="flex h-8 items-start justify-center pt-px">
                          <profil.ikon className="h-4 w-4 shrink-0 text-muted" />
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <Label>{profil.navn}</Label>
                          <Description>{profil.beskrivelse}</Description>
                        </div>
                        <Dropdown.ItemIndicator className="ms-auto" />
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Section>
                </Dropdown.Menu>
                <p className="border-t border-border px-4 py-2.5 text-xs text-muted">
                  Profilen er et udgangspunkt – du kan finjustere vægtene under Prioritet.
                </p>
              </Dropdown.Popover>
            </Dropdown>
          )}

          <Dropdown onOpenChange={(aaben) => !aaben && panelInfo.luk()}>
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-lg text-sm"
            >
              <IconAdjustmentsHorizontal className="h-4 w-4" />
              Prioritet
              {antalAendredePrioriteter > 0 && <FilterBadge antal={antalAendredePrioriteter} />}
            </Button>
            {/* overflow-visible, så infoboksen kan stå uden for panelet; selve indholdet scroller
                i stedet (max-h-[inherit] arver panelets max-højde). */}
            <Dropdown.Popover
              className={`overflow-visible ${kategorier.length > 1 ? "w-[580px] max-w-[calc(100vw-2rem)]" : "min-w-[280px]"}`}
            >
              {panelInfoKategori !== undefined && (
                <div
                  {...panelInfo.boksProps}
                  role="region"
                  aria-label={
                    panelInfoKategori ? `Om ${panelInfoKategori.navn}` : "Om vægt pr. kategori"
                  }
                  // Til venstre for panelet med toppen i flugt; på smalle skærme er der ikke
                  // plads, så den lægger sig over panelets top i stedet.
                  className="absolute inset-x-0 top-0 z-10 rounded-2xl border border-border bg-overlay p-3 shadow-(--overlay-shadow) sm:inset-x-auto sm:right-full sm:mr-2 sm:w-72"
                >
                  {panelInfoKategori ? (
                    <KategoriInfoIndhold kategori={panelInfoKategori} />
                  ) : (
                    <PrioritetInfoIndhold />
                  )}
                </div>
              )}
              <div className="flex max-h-[inherit] flex-col gap-4 overflow-y-auto p-3">
                {/* Nulstilling sker med "Nulstil filtre" i værktøjslinjen. */}
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-foreground">Vægt pr. kategori</p>
                  <InfoKnap label="Hvad er Prioritet?" {...panelInfo.knapProps("prioritet")} />
                  {kategorier.length > 1 && (
                    // Slår alle fra, så man kan vælge de få, der betyder noget; ellers alle til.
                    <button
                      type="button"
                      onClick={() => {
                        const alleTil = antalAktiveKategorier < kategorier.length;
                        setAktiveKategorier(Object.fromEntries(kategorier.map((k) => [k.id, alleTil])));
                      }}
                      className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                    >
                      {antalAktiveKategorier < kategorier.length ? "Slå alle til" : "Slå alle fra"}
                    </button>
                  )}
                </div>

                {/* Uden aktive kategorier får alle kommuner samme score (se vaegtetScore). */}
                {antalAktiveKategorier === 0 && (
                  <p className="-mt-2 text-xs text-muted">
                    Slå de kategorier til, der skal tælle med i scoren.
                  </p>
                )}

                {/* To kolonner, der fyldes række for række, så den sidste kategori står nederst. */}
                <div className="grid gap-3 sm:grid-cols-2">
                {kategorier.map((kat) => {
                  const aktiv = aktiveKategorier[kat.id] ?? true;
                  const andel = andelAfScore(kat);
                  return (
                    <div
                      key={kat.id}
                      className={`flex flex-col gap-2.5 rounded-xl border border-border p-3 transition-colors duration-150 ${
                        aktiv ? "bg-surface" : "bg-surface-secondary/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className={`flex min-w-0 items-center gap-1.5 transition-opacity duration-150 ${
                            aktiv ? "" : "opacity-50"
                          }`}
                        >
                          <KategoriIkon navn={kat.ikon} className="h-4 w-4 shrink-0 text-muted" />
                          <Label className="truncate">{kat.navn}</Label>
                          <InfoKnap
                            label={`Hvad indgår i ${kat.navn}?`}
                            {...panelInfo.knapProps(kat.id)}
                          />
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`text-xs tabular-nums transition-opacity duration-150 ${
                              aktiv ? "text-muted" : "text-muted opacity-50"
                            }`}
                            title="Kategoriens andel af den samlede score"
                          >
                            {andel > 0 && andel < 1 ? "<1" : Math.round(andel)} %
                            <span className="sr-only"> af den samlede score</span>
                          </span>
                          <Switch
                            size="sm"
                            isSelected={aktiv}
                            onChange={(valgt) =>
                              setAktiveKategorier((a) => ({ ...a, [kat.id]: valgt }))
                            }
                            aria-label={aktiv ? `Fravælg ${kat.navn}` : `Medtag ${kat.navn}`}
                          >
                            <Switch.Content>
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch.Content>
                          </Switch>
                        </div>
                      </div>

                      <div className="flex items-end gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between text-[10px] text-muted">
                            <span>Lav</span>
                            <span>Høj</span>
                          </div>
                          <Slider
                            className={`mt-0.5 w-full transition-opacity duration-150 ${aktiv ? "" : "opacity-40"}`}
                            minValue={0}
                            maxValue={100}
                            step={5}
                            isDisabled={!aktiv}
                            value={prioriteter[kat.id] ?? PRIORITET_STANDARD}
                            onChange={(v) =>
                              setPrioriteter((p) => ({
                                ...p,
                                [kat.id]: Array.isArray(v) ? v[0] : v,
                              }))
                            }
                            aria-label={kat.navn}
                          >
                            <Slider.Track>
                              <Slider.Fill />
                              <Slider.Thumb />
                            </Slider.Track>
                          </Slider>
                        </div>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          step={5}
                          disabled={!aktiv}
                          value={prioriteter[kat.id] ?? PRIORITET_STANDARD}
                          onChange={(e) => {
                            const raa = e.target.value;
                            if (raa === "") return;
                            const tal = Number(raa);
                            if (!Number.isFinite(tal)) return;
                            const klemt = Math.min(100, Math.max(0, Math.round(tal)));
                            setPrioriteter((p) => ({ ...p, [kat.id]: klemt }));
                          }}
                          onBlur={(e) => {
                            const tal = e.target.value === "" ? PRIORITET_STANDARD : Number(e.target.value);
                            const basis = Number.isFinite(tal) ? tal : PRIORITET_STANDARD;
                            const afrundet = Math.min(100, Math.max(0, Math.round(basis / 5) * 5));
                            setPrioriteter((p) => ({ ...p, [kat.id]: afrundet }));
                          }}
                          aria-label={`${kat.navn} – vægt i tal`}
                          className="w-9 shrink-0 rounded-md border border-border bg-surface px-1 py-1 text-right text-xs tabular-nums text-foreground outline-none transition-colors focus:border-accent disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </div>

                      {noegletalValgFor(kat) && (
                        <NoegletalVaelger
                          kategori={kat}
                          valg={noegletalValgFor(kat)!}
                          valgteIder={valgteIder(kat)}
                          aktiv={aktiv}
                          antalUdenData={
                            kommuneScores.filter((s) => kategoriScore(s.kode, kat) === null).length
                          }
                          onVaelg={(ider) => setNoegletalValg((v) => ({ ...v, [kat.id]: ider }))}
                        />
                      )}

                      {kat.slug === PENDLING_SLUG && (
                        <div
                          className={`flex flex-col gap-1 transition-opacity duration-150 ${aktiv ? "" : "pointer-events-none opacity-40"}`}
                        >
                          <AdresseFelt adresse={minAdresse} onVaelg={vaelgAdresse} />
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>

                {kategorier.length === 0 && (
                  <p className="text-sm text-muted">Ingen kategorier oprettet endnu.</p>
                )}
              </div>
            </Dropdown.Popover>
          </Dropdown>

          <Dropdown>
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-lg text-sm"
            >
              <IconSettings className="h-4 w-4" />
              Indstillinger
            </Button>
            <Dropdown.Popover className="w-72">
              <div className="flex flex-col gap-4 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">
                    Fremhæv ved mus
                  </span>
                  <Switch
                    size="sm"
                    isSelected={museOverAktiv}
                    onChange={setMuseOverAktiv}
                    aria-label="Fremhæv kommune ved museover på kortet"
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">
                    Fremhæv ved klik
                  </span>
                  <Switch
                    size="sm"
                    isSelected={klikFremhaevAktiv}
                    onChange={setKlikFremhaevAktiv}
                    aria-label="Fremhæv valgt kommune på kortet"
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">Farv kortet efter</span>
                  <ToggleButtonGroup
                    aria-label="Farv kortet efter"
                    size="sm"
                    fullWidth
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[farvEfterPlacering ? "placering" : "score"]}
                    onSelectionChange={(keys) => setFarvEfterPlacering(keys.has("placering"))}
                  >
                    <ToggleButton id="score">Score</ToggleButton>
                    <ToggleButton id="placering">
                      <ToggleButtonGroup.Separator />
                      Placering
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <p className="text-xs leading-snug text-muted">
                    {farvEfterPlacering
                      ? "Hver farve dækker lige mange kommuner, fra de laveste til de bedste."
                      : "Farven følger scoren, fra de viste kommuners laveste til højeste. Afstande mellem kommunerne bevares."}
                  </p>
                </div>

                <Separator />

                <p className="text-sm font-medium text-foreground">Farvepalet på kortet</p>
                <div className="flex flex-col gap-1.5">
                  {(Object.entries(KORT_PALETTER) as [KortPaletId, (typeof KORT_PALETTER)[KortPaletId]][]).map(
                    ([id, palet]) => {
                      const valgt = farvePaletId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setFarvePaletId(id)}
                          className={`flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors duration-150 ${
                            valgt
                              ? "border-accent bg-accent/5"
                              : "border-border hover:bg-surface-secondary"
                          }`}
                        >
                          <span className="flex h-5 w-14 shrink-0 overflow-hidden rounded-md">
                            {palet.farver.map((farve, i) => (
                              <span
                                key={i}
                                className="h-full flex-1"
                                style={{ backgroundColor: farve }}
                              />
                            ))}
                          </span>
                          <span className="flex-1 text-sm text-foreground">{palet.navn}</span>
                          {valgt && <IconCheck className="h-4 w-4 shrink-0 text-accent" />}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>

      <div
        className={
          visning === "kort" ? "lg:flex lg:min-h-0 lg:flex-1 lg:border-t lg:border-border" : "hidden"
        }
      >
      {/* Sidepanel til venstre for kortet (kun på store skærme): samme kommunekort som i
          Oversigt, sorteret efter score og filtreret af søgning og Område. */}
      <aside
        aria-label="Kommuner"
        className={`hidden w-1/5 shrink-0 overflow-y-auto border-r border-border bg-surface ${
          sidepanelSkjult ? "" : "lg:block"
        }`}
      >
        <div className="@container sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
          {listeVaerktoej}
        </div>

        <div className="flex flex-col gap-3 p-4">
          {sidepanelListe.slice(0, antalVist).map((k) => (
            <KommuneKort
              key={k.kode}
              kommune={k}
              rang={rangAf(k.kode)}
              score={vaegtetScore(k.kode)}
              valgt={valgtKode === k.kode}
              profil={kommuneProfiler.get(k.kode)}
              noegletalTekst={(kat, styrke) => noegletalTekst(k.kode, kat, styrke)}
              lavtBillede
              harBillede={billedKoder.has(k.kode)}
              favorit={favoritter.includes(k.kode)}
              onFavorit={(k) => skiftFavorit(k.kode)}
              onVaelg={vaelgFraSidepanel}
            />
          ))}

          <VisFlere
            vist={antalVist}
            ialt={sidepanelListe.length}
            bid={SIDEPANEL_BID}
            onVisFlere={() =>
              setVisFlere({ noegle: sidepanelNoegle, antal: antalVist + SIDEPANEL_BID })
            }
          />

          {sidepanelListe.length === 0 && ingenKommunerEllerFavoritter}
        </div>
      </aside>

      <div className="relative mx-4 h-[520px] overflow-hidden rounded-[1.75rem] border border-border shadow-sm sm:mx-6 sm:h-[620px] lg:mx-0 lg:h-full lg:flex-1 lg:rounded-none lg:border-0 lg:shadow-none">
        <div ref={containerRef} className="h-full w-full" />
        <AiChat />
        {zoomIkonPladser && createPortal(<IconPlus className="h-5 w-5" />, zoomIkonPladser.ind)}
        {zoomIkonPladser && createPortal(<IconMinus className="h-5 w-5" />, zoomIkonPladser.ud)}
        {!klar && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-secondary">
            <Spinner />
            <p className="text-sm text-muted">Indlæser kort…</p>
          </div>
        )}

        {klar && scoreSpaend && (
          <Surface
            aria-label={
              farvEfterPlacering
                ? `Farveskala efter placering, fra laveste til bedste. Kommunerne ligger mellem ${scoreSpaend.laveste} og ${scoreSpaend.hoejeste}.`
                : `Farveskala fra ${Math.round(farveSkala.fra)} til ${Math.round(farveSkala.til)}. Kommunerne ligger mellem ${scoreSpaend.laveste} og ${scoreSpaend.hoejeste}.`
            }
            className="absolute left-4 top-4 z-10 flex flex-col gap-1.5 rounded-xl border border-border px-3 py-2 shadow-lg"
          >
            <span className="text-left text-xs leading-tight font-medium text-muted">
              {farvEfterPlacering ? "Placering" : "Score"}
            </span>
            {/* Efter score: skalaen følger de viste kommuners spænd (mindst
                FARVESKALA_MIN_SPAEND point), og rammen viser, hvor kommunerne ligger på den.
                Efter placering: hele paletten fordeles ligeligt på kommunerne, så rammen
                omkranser hele skalaen. */}
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="text-xs tabular-nums text-muted">
                {farvEfterPlacering ? "Laveste" : Math.round(farveSkala.fra)}
              </span>
              <span className="relative w-36 sm:w-44">
                <span className="flex h-2.5 overflow-hidden rounded-full">
                  {KORT_PALETTER[farvePaletId].farver.map((farve, i) => (
                    <span key={i} className="h-full flex-1" style={{ backgroundColor: farve }} />
                  ))}
                </span>
                <span
                  className="absolute -inset-y-1 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.12),0_1px_3px_rgb(0_0_0/0.2)]"
                  style={
                    farvEfterPlacering
                      ? { left: 0, right: 0 }
                      : {
                          left: `${scoreTilProcent(scorerMedData.at(-1)!, farveSkala)}%`,
                          right: `${100 - scoreTilProcent(scorerMedData[0], farveSkala)}%`,
                        }
                  }
                />
              </span>
              <span className="text-xs tabular-nums text-muted">
                {farvEfterPlacering ? "Bedste" : Math.round(farveSkala.til)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-left text-xs leading-tight text-muted">
                Kommunerne ligger fra{" "}
                <span className="font-semibold tabular-nums text-foreground">{scoreSpaend.laveste}</span>{" "}
                til{" "}
                <span className="font-semibold tabular-nums text-foreground">{scoreSpaend.hoejeste}</span>
              </span>
              <ScoreInfo farvEfterPlacering={farvEfterPlacering} />
            </div>
          </Surface>
        )}

        {klar && valgtKommune && (
          // Højst kortets højde; er der ikke plads til alle kategorier, ruller listen.
          <div className="absolute right-4 top-4 z-10 flex max-h-[calc(100%-2rem)] w-64 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg sm:w-72">
            <div className="relative flex h-20 shrink-0 items-center justify-center bg-gradient-to-br from-surface-secondary to-accent/10">
              <KommuneBillede
                key={valgtKommune.kode}
                kode={valgtKommune.kode}
                navn={valgtKommune.navn}
                harBillede={billedKoder.has(valgtKommune.kode)}
                ikonClassName="h-7 w-7 text-muted/50"
              />
              {valgtKommuneRang > 0 && (
                <span
                  className={`absolute -bottom-4 left-3 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-md ring-4 ring-surface ${rankFarve(
                    valgtKommuneRang,
                  )}`}
                >
                  {valgtKommuneRang}.
                </span>
              )}
              <button
                type="button"
                onClick={() => setValgtKode(null)}
                aria-label="Luk"
                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-muted shadow-sm transition-colors duration-150 hover:text-foreground"
              >
                <IconX className="h-4 w-4" />
              </button>
              <FavoritKnap
                navn={valgtKommune.navn}
                favorit={favoritter.includes(valgtKommune.kode)}
                onSkift={() => skiftFavorit(valgtKommune.kode)}
                className="absolute right-10 top-2 h-7! w-7!"
              />
            </div>
            <div className="flex items-center justify-between gap-2 p-3.5 pl-16">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{valgtKommune.navn}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {REGION_NAVNE[valgtKommune.regionskode] ?? "Ukendt region"}
                </p>
              </div>
              <ScoreBadge score={vaegtetScore(valgtKommune.kode)} />
            </div>
            <div className="min-h-0 overflow-y-auto">
              <ValgtKommuneKategorier raekker={valgtKommuneKategorier} />
            </div>
            <div className="shrink-0">
              <GennemsnitForklaring />
              <RapportLink navn={valgtKommune.navn} />
            </div>
          </div>
        )}
      </div>
      </div>

      {visning === "oversigt" && (
        <div className={`${INDHOLD_BREDDE} lg:min-h-0 lg:flex-1`}>
        {/* På store skærme fylder boksen pladsen mellem værktøjslinjen og footeren
            (se html[data-laast-visning] i globals.css). */}
        <div className="flex h-[550px] flex-col overflow-hidden sm:h-[650px] lg:h-full rounded-[1.75rem] border border-border bg-surface shadow-sm">
        <div className="@container shrink-0 border-b border-border px-5 py-3">
          {listeVaerktoej}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-5">
          {/* Kortene har Styrker/Fokusområder i to kolonner, så de skal have en vis bredde. */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {sidepanelListe.slice(0, oversigtAntalVist).map((k) => (
              <KommuneKort
              key={k.kode}
              kommune={k}
              rang={rangAf(k.kode)}
              score={vaegtetScore(k.kode)}
              profil={kommuneProfiler.get(k.kode)}
              noegletalTekst={(kat, styrke) => noegletalTekst(k.kode, kat, styrke)}
              harBillede={billedKoder.has(k.kode)}
              favorit={favoritter.includes(k.kode)}
              onFavorit={(k) => skiftFavorit(k.kode)}
              onVaelg={vaelgFraOversigt}
            />
            ))}

            {sidepanelListe.length === 0 && ingenKommunerEllerFavoritter}
          </div>

          <div className="mx-auto mt-3 max-w-sm pb-2">
            <VisFlere
              vist={oversigtAntalVist}
              ialt={sidepanelListe.length}
              bid={OVERSIGT_BID}
              onVisFlere={() =>
                setOversigtVisFlere({
                  noegle: sidepanelNoegle,
                  antal: oversigtAntalVist + OVERSIGT_BID,
                })
              }
            />
          </div>
        </div>
        <div className="h-5 shrink-0" />
        </div>
        </div>
      )}

      {visning === "regneark" && (
        <div className={`${INDHOLD_BREDDE} lg:min-h-0 lg:flex-1`}>
        {/* På store skærme fylder boksen pladsen mellem værktøjslinjen og footeren
            (se html[data-laast-visning] i globals.css). */}
        <div className="flex h-[520px] flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm sm:h-[620px] lg:h-full">
        <div className="@container shrink-0 border-b border-border px-5 py-3">
          {listeVaerktoej}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {/* Samme sortering som sidepanelet i Kort: klik på en overskrift sorterer efter
              den, og et klik mere vender retningen. */}
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-muted">
                <th className="w-16 px-4 py-3 font-medium">#</th>
                <SorterbarOverskrift
                  felt="navn"
                  label="Kommune"
                  sortFelt={sortFelt}
                  sortRetning={sortRetning}
                  onSorter={sorterEfterKolonne}
                />
                <th className="px-4 py-3 font-medium">Region</th>
                <SorterbarOverskrift
                  felt="score"
                  label="Samlet score"
                  sortFelt={sortFelt}
                  sortRetning={sortRetning}
                  onSorter={sorterEfterKolonne}
                  hoejre
                />
                {kategorier.map((kat) => (
                  <SorterbarOverskrift
                    key={kat.id}
                    felt={`kat-${kat.id}`}
                    label={kat.navn}
                    ikon={kat.ikon}
                    sortFelt={sortFelt}
                    sortRetning={sortRetning}
                    onSorter={sorterEfterKolonne}
                    hoejre
                    inaktiv={aktiveKategorier[kat.id] === false}
                  />
                ))}
                <th className="px-4 py-3">
                  <span className="sr-only">Rapport</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sidepanelListe.map((k) => {
                const rang = rangAf(k.kode);
                return (
                  <tr
                    key={k.kode}
                    onClick={() => vaelgFraOversigt(k)}
                    className={`cursor-pointer border-b border-border/60 transition-colors duration-150 ${
                      valgtKode === k.kode ? "bg-accent/10" : "hover:bg-surface-secondary"
                    }`}
                  >
                    <td className="px-4 py-2">
                      {rang > 0 && (
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${rankFarve(
                            rang,
                          )}`}
                        >
                          {rang}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium text-foreground">{k.navn}</td>
                    <td className="px-4 py-2 text-muted">
                      {REGION_NAVNE[k.regionskode] ?? "Ukendt"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end">
                        <ScoreBadge score={vaegtetScore(k.kode)} />
                      </div>
                    </td>
                    {kategorier.map((kat) => {
                      const score = kategoriScore(k.kode, kat);
                      return (
                        <td
                          key={kat.id}
                          className={`px-4 py-2 text-right tabular-nums ${
                            aktiveKategorier[kat.id] === false ? "text-muted/50" : "text-foreground"
                          }`}
                        >
                          {score === null ? "–" : Math.round(score)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right">
                      {/* Hjertet vælger ikke rækken, kun favoritten. */}
                      <span
                        className="inline-flex items-center gap-2 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FavoritKnap
                          navn={k.navn}
                          favorit={favoritter.includes(k.kode)}
                          onSkift={() => skiftFavorit(k.kode)}
                          className="h-7! w-7! bg-transparent! shadow-none!"
                        />
                        <a
                          href={`/kommune/${kommuneSlug(k.navn)}`}
                          target="_blank"
                          rel="noopener"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent/10"
                        >
                          <IconFileText className="h-3.5 w-3.5" />
                          Rapport
                        </a>
                      </span>
                    </td>
                  </tr>
                );
              })}

              {sidepanelListe.length === 0 && (
                <tr>
                  <td colSpan={kategorier.length + 5} className="px-5 py-12 text-sm text-muted">
                    {kunFavoritter && favoritter.length === 0 ? (
                      "Du har ingen favoritter endnu. Tryk på hjertet på en kommune for at gemme den her."
                    ) : klar ? (
                      "Ingen kommuner matcher."
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner size="sm" /> Indlæser kommuner…
                      </span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="h-5 shrink-0" />
        </div>
        </div>
      )}
    </div>
  );
}
