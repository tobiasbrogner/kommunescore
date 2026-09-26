"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Map as MapLibreMap,
  NavigationControl,
  type IControl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Button,
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
  IconWorldMap,
  IconChevronsDown,
  IconHome,
  IconLayoutGrid,
  IconLayoutColumns,
  IconHelpCircle,
  IconMap,
  IconMinus,
  IconPlus,
  IconSettings,
  IconSortAscending,
  IconSortDescending,
  IconTarget,
  IconTrendingUp,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import type { KategoriMeta, KommuneScore } from "@/lib/scores/compute";
import { KategoriIkon } from "@/components/ikon";
import { REGION_NAVNE } from "@/lib/kommuner/regioner";
import { polygonArealKm2 } from "@/lib/kommuner/areal";
import { kommuneSlug } from "@/lib/kommuner/slug";
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

type Visning = "kort" | "oversigt" | "regneark";

// Sidepanelets sortering: samlet score, navn eller en enkelt kategoris score ("kat-<id>").
type SortFelt = "score" | "navn" | `kat-${number}`;
type SortRetning = "stigende" | "faldende";

const KOMMUNER_URL = "/data/kommuner.geojson";
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

// Kun kommunens største landdel, så navnet står én gang (på fastlandet) og ikke på
// hver ø. MapLibre placerer teksten midt inde i polygonen.
function kommuneNavneDele(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
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
      ...del,
      properties: { ...del.properties, navn: navnPrKode.get(del.properties?.kode as string) },
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
// Blå og Grøn er sammenhængende OKLCH-ramper fra lys til mørk.
const KORT_FARVE_VALGT = "#4b5563";
type KortPaletId = "groen-gul-orange" | "blaa" | "groen";
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
  blaa: {
    navn: "Blå",
    farver: [
      "#cbd9ec", // 1 – laveste
      "#b5cbe9",
      "#9fbee7",
      "#88b0e3",
      "#71a2e0",
      "#5993db",
      "#4485d4",
      "#3378cb",
      "#256cbd",
      "#195fae",
      "#155399",
      "#124784", // 12 – højeste
    ],
  },
  groen: {
    navn: "Grøn",
    farver: [
      "#ccddcc", // 1 – laveste
      "#b7d2b7",
      "#a1c7a1",
      "#8bbc8c",
      "#74b077",
      "#5da360",
      "#48964d",
      "#35893c",
      "#257a2e",
      "#156c22",
      "#0c5e1a",
      "#065114", // 12 – højeste
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

// En scores placering (0-100 %) på farveskalaen, der går fra 50 til 100.
function scoreTilProcent(score: number) {
  return Math.min(100, Math.max(0, ((score - 50) / 50) * 100));
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
    [
      "step",
      ["coalesce", ["feature-state", "score"], taerskler[0]],
      farver[0],
      ...taerskler.flatMap((taerskel, i) => [taerskel, farver[i + 1]]),
    ],
  ];
}

const LANDSDEL_NAVNE: Record<string, string> = {
  jylland: "Jylland",
  fyn: "Fyn",
  sjaelland: "Sjælland",
};

// Region Syddanmark (1083) dækker både Jylland og Fyn, så de fynske
// kommuner skal udpeges eksplicit for at kunne udlede landsdelen.
const FYN_KOMMUNE_KODER = new Set([
  "0410", // Middelfart
  "0420", // Assens
  "0430", // Faaborg-Midtfyn
  "0440", // Kerteminde
  "0450", // Nyborg
  "0461", // Odense
  "0479", // Svendborg
  "0480", // Nordfyns
  "0482", // Langeland
  "0492", // Ærø
]);

function landsdelForKommune(kode: string, regionskode: string): string {
  if (regionskode === "1081" || regionskode === "1082") return "jylland";
  if (regionskode === "1083") return FYN_KOMMUNE_KODER.has(kode) ? "fyn" : "jylland";
  return "sjaelland";
}

function kommuneMatcherFilterId(kode: string, regionskode: string, filterId: string) {
  if (filterId in REGION_NAVNE) return regionskode === filterId;
  return landsdelForKommune(kode, regionskode) === filterId;
}

// Danmarks Statistiks kommunegruppering, se
// https://www.dst.dk/da/Statistik/dokumentation/nomenklaturer/kommunegrupper
const GRUPPE_NAVNE: Record<string, string> = {
  "1": "Hovedstadskommuner",
  "2": "Storbykommuner",
  "3": "Provinsbykommuner",
  "4": "Oplandskommuner",
  "5": "Landkommuner",
};

const GRUPPE_BESKRIVELSE: Record<string, string> = {
  "1": "Kommuner med meget høj adgang til arbejdspladser.",
  "2": "Største by har mindst 100.000 indbyggere.",
  "3": "Største by har mindst 30.000 indbyggere.",
  "4": "Mindre største by, men relativt god adgang til arbejdspladser.",
  "5": "Mindre største by og relativt lav adgang til arbejdspladser.",
};

const GRUPPE_KOMMUNE_KODER: Record<string, string[]> = {
  "1": [
    "0101", "0147", "0151", "0153", "0155", "0157", "0159", "0161", "0163",
    "0165", "0167", "0169", "0173", "0175", "0183", "0185", "0187", "0190",
    "0201", "0223", "0230", "0240", "0253", "0269",
  ],
  "2": ["0461", "0751", "0851"],
  "3": [
    "0217", "0219", "0259", "0265", "0330", "0370", "0561", "0607", "0615",
    "0621", "0630", "0657", "0661", "0730", "0740", "0791",
  ],
  "4": [
    "0210", "0250", "0260", "0270", "0316", "0320", "0329", "0336", "0340",
    "0350", "0410", "0420", "0430", "0440", "0450", "0480", "0575", "0706",
    "0710", "0727", "0746", "0756", "0766", "0840",
  ],
  "5": [
    "0306", "0326", "0360", "0376", "0390", "0400", "0479", "0482", "0492",
    "0510", "0530", "0540", "0550", "0563", "0573", "0580", "0665", "0671",
    "0707", "0741", "0760", "0773", "0779", "0787", "0810", "0813", "0820",
    "0825", "0846", "0849", "0860",
  ],
};

const KOMMUNE_GRUPPE_ID = new Map<string, string>();
Object.entries(GRUPPE_KOMMUNE_KODER).forEach(([gruppeId, koder]) => {
  koder.forEach((kode) => KOMMUNE_GRUPPE_ID.set(kode, gruppeId));
});

function kommuneMatcherGruppeId(kode: string, gruppeId: string) {
  return KOMMUNE_GRUPPE_ID.get(kode) === gruppeId;
}

const DANMARK_BOUNDS: [[number, number], [number, number]] = [
  [7.8, 54.5],
  [15.3, 57.9],
];

// Zoom til de valgte områder i Område/Gruppe-filtret: lidt luft om kanten, og aldrig
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

function PrioritetInfo() {
  return (
    <Tooltip delay={150}>
      <Tooltip.Trigger aria-label="Hvad er Prioritet?">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground">
          <IconHelpCircle className="h-4 w-4" />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content
        showArrow
        placement="right"
        shouldFlip={false}
        className="w-64 break-normal"
      >
        <Tooltip.Arrow />
        <p className="text-sm text-pretty">
          Justér, hvor vigtig hver kategori er for dig. En højere vægt
          betyder, at kommunernes score i den pågældende kategori får større
          betydning for den samlede rangering. Det ændrer ikke kommunernes
          score, men kun hvordan de vægtes og sorteres.
        </p>
      </Tooltip.Content>
    </Tooltip>
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
            <strong>Område</strong> og <strong>Gruppe</strong> ændrer ikke scoren, men hvilke
            kommuner der er med. Spændet og placeringerne gælder kun de viste kommuner.
          </p>
          <p>Søgefeltet påvirker hverken score eller spænd.</p>
          {farvEfterPlacering && (
            <p>
              <strong>Farverne</strong> viser placering: hver farve dækker lige mange af de viste
              kommuner, fra de laveste (rød) til de bedste (grøn). Tallet på kommunen er stadig
              selve scoren.
            </p>
          )}
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}

function erGennemsnit(navn: string) {
  return navn.toLowerCase().includes("gennemsnit");
}

function KategoriInfo({ kategori }: { kategori: KategoriMeta }) {
  const gennemsnit = kategori.noegletal.find((n) => erGennemsnit(n.navn));
  const restNoegletal = gennemsnit
    ? kategori.noegletal.filter((n) => n !== gennemsnit)
    : kategori.noegletal;

  return (
    <Tooltip delay={150}>
      <Tooltip.Trigger aria-label={`Hvad indgår i ${kategori.navn}?`}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground">
          <IconHelpCircle className="h-4 w-4" />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content
        showArrow
        placement="right"
        shouldFlip={false}
        className="w-64 break-normal"
      >
        <Tooltip.Arrow />
        <p className="text-sm font-medium text-foreground">
          {gennemsnit
            ? `${kategori.navn} dækker ${gennemsnit.navn.toLowerCase()} for:`
            : `${kategori.navn} dækker over:`}
        </p>
        {restNoegletal.length > 0 ? (
          <ul className="mt-1.5 flex flex-col gap-0.5 text-sm text-pretty text-muted">
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
      </Tooltip.Content>
    </Tooltip>
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

function KommuneBillede({
  kode,
  navn,
  ikonClassName,
}: {
  kode: string;
  navn: string;
  ikonClassName: string;
}) {
  const [fejlet, setFejlet] = useState(false);

  if (fejlet) {
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

function ScoreBadge({ score }: { score: number }) {
  const rundet = Math.round(score);

  return (
    <div
      title={`Score: ${rundet} ud af 100`}
      className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary px-2 text-sm font-bold tabular-nums text-foreground ring-1 ring-inset ring-border/50"
    >
      {rundet}
    </div>
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
  className = "",
}: {
  titel: string;
  Ikon: typeof IconTarget;
  farve: string;
  punkter: ProfilPunkt[];
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
          {punkter.map((p) => (
            <li key={p.kategori.id} className="flex items-start gap-2">
              <KategoriIkon
                navn={p.kategori.ikon}
                className="mt-0.5 h-4 w-4 shrink-0 text-muted"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium break-words hyphens-auto text-foreground">
                  {p.kategori.navn}
                </p>
                <p className="text-xs leading-snug break-words hyphens-auto text-muted">{p.tekst}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">–</p>
      )}
    </div>
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

function KommuneKort({
  kommune: k,
  rang,
  score,
  valgt = false,
  profil,
  lavtBillede = false,
  onVaelg,
}: {
  kommune: Kommune;
  rang: number;
  score: number;
  valgt?: boolean;
  profil?: KommuneProfil;
  // Lidt lavere billede i sidepanelet, så de øverste tre kort kan ses hele.
  lavtBillede?: boolean;
  onVaelg: (k: Kommune) => void;
}) {
  return (
    <div
      data-kode={k.kode}
      className={`flex shrink-0 flex-col overflow-hidden rounded-2xl border bg-surface transition-all duration-200 hover:-translate-y-1 hover:shadow-sm ${
        valgt ? "border-accent ring-2 ring-accent/40" : "border-border"
      }`}
    >
      <button type="button" onClick={() => onVaelg(k)} className="flex-1 text-left">
        <div
          className={`relative flex ${lavtBillede ? "h-24" : "h-28"} items-center justify-center bg-gradient-to-br from-surface-secondary to-accent/10`}
        >
          <KommuneBillede kode={k.kode} navn={k.navn} ikonClassName="h-8 w-8 text-muted/50" />
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
          <div className="mx-3.5 grid grid-cols-2 gap-3 border-t border-border py-3">
            <ProfilKolonne
              titel="Styrker"
              Ikon={IconTrendingUp}
              farve="text-success"
              punkter={profil.styrker}
            />
            <ProfilKolonne
              className="border-l border-border pl-3"
              titel="Fokusområder"
              Ikon={IconTarget}
              farve="text-accent"
              punkter={profil.fokus}
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
  kategorier,
  kommuneScores,
}: {
  kategorier: KategoriMeta[];
  kommuneScores: KommuneScore[];
}) {
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
  // "Vis flere" gælder én bestemt søgning/filtrering/sortering (listeNoegle nedenfor);
  // ændres den, starter listen forfra med første bid.
  const [visFlere, setVisFlere] = useState({ noegle: "", antal: SIDEPANEL_BID });
  const visningRef = useRef<Visning>(visning);
  // Samlet udstrækning af kommunerne i det aktive Område/Gruppe-filter (null = intet filter).
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
  const [farvePaletId, setFarvePaletId] = useState<KortPaletId>(KORT_PALET_STANDARD);
  const [museOverAktiv, setMuseOverAktiv] = useState(true);
  const [klikFremhaevAktiv, setKlikFremhaevAktiv] = useState(false);
  // Test: farv kommunerne efter placering (kvantiler) i stedet for fast skala 50-100.
  const [farvEfterPlacering, setFarvEfterPlacering] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: KORT_STYLE,
      bounds: DANMARK_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
    });

    laasKortTilDanmark(map);
    // Når kortet ændrer størrelse (vindue, eller kommunelisten skjules/vises), låses det
    // til det nye udsnit; et aktivt Område/Gruppe-filter zoomes der ind på igen.
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
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: KOMMUNER_URL,
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
        data: KOMMUNER_URL,
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

      const res = await fetch(KOMMUNER_URL);
      const data: GeoJSON.FeatureCollection = await res.json();
      (map.getSource(KOMMUNE_DELE_SOURCE_ID) as GeoJSONSource).setData(opdelIKommuneDele(data));

      // Kommunenavne vises først, når man zoomer ind, og kun hvor de kan være uden
      // at overlappe hinanden (MapLibre skjuler automatisk dem, der ikke er plads til).
      map.addSource(NAVNE_SOURCE_ID, { type: "geojson", data: kommuneNavneDele(data) });
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
  };
  const antalAendredePrioriteter = kategorier.filter(
    (k) =>
      (prioriteter[k.id] ?? PRIORITET_STANDARD) !== PRIORITET_STANDARD ||
      !(aktiveKategorier[k.id] ?? true),
  ).length;

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

  const vaegtetScore = (kode: string) => {
    const kategoriScorer = kategoriScorerPrKommune.get(kode);
    if (!kategoriScorer) return PRIORITET_STANDARD;

    let sumVaegtetScore = 0;
    let sumVaegt = 0;
    for (const kat of kategorier) {
      if (aktiveKategorier[kat.id] === false) continue;
      const vaegt = prioriteter[kat.id] ?? PRIORITET_STANDARD;
      if (vaegt <= 0) continue;
      const score = kategoriScorer[kat.id] ?? PRIORITET_STANDARD;
      sumVaegtetScore += score * vaegt;
      sumVaegt += vaegt;
    }
    return sumVaegt > 0 ? sumVaegtetScore / sumVaegt : PRIORITET_STANDARD;
  };

  const sorterEfterScore = (a: Kommune, b: Kommune) =>
    vaegtetScore(b.kode) - vaegtetScore(a.kode) || a.navn.localeCompare(b.navn, "da");


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
    ],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !klar) return;

    // Farv efter placering: placeringen blandt de viste kommuner omsættes til en
    // "farvescore" på 50-100, så palettens 12 trin hver dækker lige mange kommuner,
    // uanset hvor tæt scorerne ligger. Kommuner uden for filtret er grå alligevel.
    const antal = kommunerRegionFiltreret.length;
    const farveScore = (kode: string) => {
      if (!farvEfterPlacering) return vaegtetScore(kode);
      if (antal <= 1) return 100;
      // Lige scorer deler placering, så de også får samme farve.
      const score = vaegtetScore(kode);
      const bedreEnd = kommunerRegionFiltreret.filter((k) => vaegtetScore(k.kode) > score).length;
      return 50 + (1 - bedreEnd / (antal - 1)) * 50;
    };

    kommuner.forEach((k) => {
      map.setFeatureState({ source: SOURCE_ID, id: k.kode }, { score: farveScore(k.kode) });
    });
  }, [
    klar,
    kommuner,
    kategoriScorerPrKommune,
    kategorier,
    prioriteter,
    aktiveKategorier,
    farvEfterPlacering,
    valgteRegioner,
    valgteGrupper,
  ]);

  const sortFeltNavn = (felt: SortFelt) => {
    if (felt === "score") return "Samlet score";
    if (felt === "navn") return "Navn";
    const id = Number(felt.slice(4));
    return kategorier.find((kat) => kat.id === id)?.navn ?? "Kategori";
  };

  const vaelgSortFelt = (felt: SortFelt) => {
    setSortFelt(felt);
    // Navne læses naturligt A-Å, scorer med de bedste først.
    setSortRetning(felt === "navn" ? "stigende" : "faldende");
  };

  const sidepanelKommuner = useMemo(() => {
    const vaerdi = (k: Kommune) => {
      if (sortFelt === "score") return vaegtetScore(k.kode);
      const id = Number(sortFelt.slice(4));
      return kategoriScorerPrKommune.get(k.kode)?.[id] ?? 0;
    };
    // Placeringen er højeste score først og ved lige score A-Å. Faldende følger den
    // rækkefølge, og stigende vender den helt, så placeringstallene altid står i orden.
    const retning = sortRetning === "stigende" ? 1 : -1;
    const navnOrden = (a: Kommune, b: Kommune) => a.navn.localeCompare(b.navn, "da");
    return [...kommunerFiltreret].sort((a, b) =>
      sortFelt === "navn"
        ? retning * navnOrden(a, b)
        : retning * (vaerdi(a) - vaerdi(b)) || -retning * navnOrden(a, b),
    );
  }, [kommunerFiltreret, sortFelt, sortRetning, kategoriScorerPrKommune]);

  // Ny søgning, filtrering eller sortering starter listen forfra med første bid.
  const noegleFor = (valg: Selection) => (valg === "all" ? "all" : [...valg].sort().join(","));
  const listeNoegle = [
    soegning,
    noegleFor(valgteRegioner),
    noegleFor(valgteGrupper),
    sortFelt,
    sortRetning,
  ].join("|");
  const antalVist = visFlere.noegle === listeNoegle ? visFlere.antal : SIDEPANEL_BID;

  const rangAf = (kode: string) =>
    kommunerRegionFiltreret.findIndex((k) => k.kode === kode) + 1;

  // Laveste og højeste score blandt kommunerne i Område/Gruppe-filtret (listen er
  // sorteret med højeste score først).
  const scoreSpaend =
    kommunerRegionFiltreret.length > 0
      ? {
          hoejeste: Math.round(vaegtetScore(kommunerRegionFiltreret[0].kode)),
          laveste: Math.round(vaegtetScore(kommunerRegionFiltreret.at(-1)!.kode)),
        }
      : null;

  const valgtKommune = kommuner.find((k) => k.kode === valgtKode) ?? null;
  const valgtKommuneRang = valgtKommune ? rangAf(valgtKommune.kode) : 0;

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

          <Dropdown>
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-lg text-sm"
            >
              <IconWorldMap className="h-4 w-4" />
              Område
              {regionFilterAktiv && <FilterBadge antal={valgteRegioner.size} />}
            </Button>
            <Dropdown.Popover className="min-w-[220px]">
              <Dropdown.Menu
                selectedKeys={valgteRegioner}
                selectionMode="multiple"
                onSelectionChange={setValgteRegioner}
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
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          <Dropdown>
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-lg text-sm"
            >
              <IconUsers className="h-4 w-4" />
              Gruppe
              {gruppeFilterAktiv && <FilterBadge antal={valgteGrupper.size} />}
            </Button>
            <Dropdown.Popover className="min-w-[260px]">
              <Dropdown.Menu
                selectedKeys={valgteGrupper}
                selectionMode="multiple"
                onSelectionChange={setValgteGrupper}
              >
                {Object.entries(GRUPPE_NAVNE).map(([id, navn]) => (
                  <Dropdown.Item key={id} id={id} textValue={navn}>
                    <RegionAfkrydsning />
                    <Label>{navn}</Label>
                    <GruppeInfo beskrivelse={GRUPPE_BESKRIVELSE[id]} />
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          <Dropdown>
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-lg text-sm"
            >
              <IconAdjustmentsHorizontal className="h-4 w-4" />
              Prioritet
              {antalAendredePrioriteter > 0 && <FilterBadge antal={antalAendredePrioriteter} />}
            </Button>
            <Dropdown.Popover className={kategorier.length > 1 ? "w-[580px] max-w-[calc(100vw-2rem)]" : "min-w-[280px]"}>
              <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-3">
                {/* Nulstilling sker med "Nulstil filtre" i værktøjslinjen. */}
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-foreground">Vægt pr. kategori</p>
                  <PrioritetInfo />
                </div>

                {/* To kolonner, der fyldes oppefra og ned: først venstre kolonne, så højre. */}
                <div
                  className="grid gap-3 sm:grid-flow-col sm:grid-cols-2"
                  style={{ gridTemplateRows: `repeat(${Math.ceil(kategorier.length / 2)}, auto)` }}
                >
                {kategorier.map((kat) => {
                  const aktiv = aktiveKategorier[kat.id] ?? true;
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
                          <KategoriInfo kategori={kat} />
                        </div>
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
                      : "Farven følger scoren på en fast skala fra 50 til 100."}
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
          Oversigt, sorteret efter score og filtreret af søgning og Område/Gruppe. */}
      <aside
        aria-label="Kommuner"
        className={`hidden w-1/4 shrink-0 overflow-y-auto border-r border-border bg-surface ${
          sidepanelSkjult ? "" : "lg:block"
        }`}
      >
        <div className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Dropdown>
              <Button
                variant="outline"
                className="h-10 shrink-0 gap-1.5 rounded-lg text-sm"
              >
                <span className="truncate">
                  <span className="text-muted">Sortér:</span> {sortFeltNavn(sortFelt)}
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
              className="h-10 w-10 shrink-0 rounded-lg"
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

            {/* Vises kun, når søgning eller filtre har skåret kommuner fra. */}
            <p className="ml-auto min-w-0 text-right text-xs leading-tight text-muted" aria-live="polite">
              {kommuner.length > 0 && sidepanelKommuner.length < kommuner.length && (
                <>
                  <span className="font-semibold text-foreground">{sidepanelKommuner.length}</span>{" "}
                  ud af {kommuner.length} kommuner fundet
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {sidepanelKommuner.slice(0, antalVist).map((k) => (
            <KommuneKort
              key={k.kode}
              kommune={k}
              rang={rangAf(k.kode)}
              score={vaegtetScore(k.kode)}
              valgt={valgtKode === k.kode}
              profil={kommuneProfiler.get(k.kode)}
              lavtBillede
              onVaelg={vaelgFraSidepanel}
            />
          ))}

          <VisFlere
            vist={antalVist}
            ialt={sidepanelKommuner.length}
            bid={SIDEPANEL_BID}
            onVisFlere={() =>
              setVisFlere({ noegle: listeNoegle, antal: antalVist + SIDEPANEL_BID })
            }
          />

          {kommunerFiltreret.length === 0 && ingenKommuner}
        </div>
      </aside>

      <div className="relative mx-4 h-[520px] overflow-hidden rounded-[1.75rem] border border-border shadow-sm sm:mx-6 sm:h-[620px] lg:mx-0 lg:h-full lg:flex-1 lg:rounded-none lg:border-0 lg:shadow-none">
        <div ref={containerRef} className="h-full w-full" />
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
                : `Farveskala fra 50 til 100. Kommunerne ligger mellem ${scoreSpaend.laveste} og ${scoreSpaend.hoejeste}.`
            }
            className="absolute left-4 top-4 z-10 flex flex-col gap-1.5 rounded-xl border border-border px-3 py-2 shadow-lg"
          >
            <span className="text-left text-xs leading-tight font-medium text-muted">
              {farvEfterPlacering ? "Placering" : "Score"}
            </span>
            {/* Fast skala: farverne følger scoren 50-100, og rammen viser, hvor kommunerne
                i det aktuelle filter ligger. Efter placering: hele paletten fordeles ligeligt
                på kommunerne, så rammen omkranser hele skalaen. */}
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="text-xs tabular-nums text-muted">
                {farvEfterPlacering ? "Laveste" : "50"}
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
                          left: `${scoreTilProcent(scoreSpaend.laveste)}%`,
                          right: `${100 - scoreTilProcent(scoreSpaend.hoejeste)}%`,
                        }
                  }
                />
              </span>
              <span className="text-xs tabular-nums text-muted">
                {farvEfterPlacering ? "Bedste" : "100"}
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
          <div className="absolute right-4 top-4 z-10 w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg sm:w-72">
            <div className="relative flex h-20 items-center justify-center bg-gradient-to-br from-surface-secondary to-accent/10">
              <KommuneBillede
                key={valgtKommune.kode}
                kode={valgtKommune.kode}
                navn={valgtKommune.navn}
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
            <RapportLink navn={valgtKommune.navn} />
          </div>
        )}
      </div>
      </div>

      {visning === "oversigt" && (
        <div className={`${INDHOLD_BREDDE} lg:min-h-0 lg:flex-1`}>
        {/* På store skærme fylder boksen pladsen mellem værktøjslinjen og footeren
            (se html[data-laast-visning] i globals.css). */}
        <div className="flex h-[550px] flex-col overflow-hidden sm:h-[650px] lg:h-full rounded-[1.75rem] border border-border bg-surface shadow-sm">
        <div className="h-5 shrink-0" />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-2">
          {/* Kortene har Styrker/Fokusområder i to kolonner, så de skal have en vis bredde. */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {kommunerFiltreret.map((k) => (
              <KommuneKort
              key={k.kode}
              kommune={k}
              rang={rangAf(k.kode)}
              score={vaegtetScore(k.kode)}
              profil={kommuneProfiler.get(k.kode)}
              onVaelg={vaelgFraOversigt}
            />
            ))}

            {kommunerFiltreret.length === 0 && ingenKommuner}
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
        {/* Luft over og under scrollområdet, så scrollbaren holder sig fri af de runde
            hjørner (som i Oversigt). */}
        <div className="h-5 shrink-0" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-muted">
                <th className="px-5 py-3 font-medium">Kommune</th>
                <th className="px-5 py-3 font-medium">Kode</th>
                <th className="px-5 py-3 font-medium">Region</th>
              </tr>
            </thead>
            <tbody>
              {kommunerFiltreret.map((k) => (
                <tr
                  key={k.kode}
                  onClick={() => vaelgKommune(k)}
                  className={`cursor-pointer border-b border-border/60 transition-colors duration-150 ${
                    valgtKode === k.kode ? "bg-accent/10" : "hover:bg-surface-secondary"
                  }`}
                >
                  <td className="px-5 py-2.5 font-medium text-foreground">{k.navn}</td>
                  <td className="px-5 py-2.5 text-muted">{k.kode}</td>
                  <td className="px-5 py-2.5 text-muted">
                    {REGION_NAVNE[k.regionskode] ?? "Ukendt"}
                  </td>
                </tr>
              ))}

              {kommunerFiltreret.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-sm text-muted">
                    {klar ? (
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
