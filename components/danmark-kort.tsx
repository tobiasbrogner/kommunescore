"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Button,
  Dropdown,
  Header,
  Label,
  Separator,
  Spinner,
  Tooltip,
  type Selection,
} from "@heroui/react";
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconFileText,
  IconFilter,
  IconHome,
  IconLayoutGrid,
  IconLayoutColumns,
  IconHelpCircle,
  IconMap,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

type Kommune = {
  kode: string;
  navn: string;
  regionskode: string;
};

type Visning = "kort" | "oversigt" | "regneark";

const KOMMUNER_URL = "/data/kommuner.geojson";
const SOURCE_ID = "kommuner";

const REGION_NAVNE: Record<string, string> = {
  "1081": "Region Nordjylland",
  "1082": "Region Midtjylland",
  "1083": "Region Syddanmark",
  "1084": "Region Hovedstaden",
  "1085": "Region Sjælland",
};

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

const MAX_BOUNDS: [[number, number], [number, number]] = [
  [6.0, 53.3],
  [17.0, 58.7],
];

const KORT_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "hav",
      type: "background",
      paint: { "background-color": "#dce7ec" },
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

const VISNINGER: { id: Visning; label: string; Ikon: () => React.JSX.Element }[] = [
  { id: "oversigt", label: "Oversigt", Ikon: () => <IconLayoutGrid className="h-4 w-4" /> },
  { id: "kort", label: "Kort", Ikon: () => <IconMap className="h-4 w-4" /> },
  { id: "regneark", label: "Regneark", Ikon: () => <IconLayoutColumns className="h-4 w-4" /> },
];

export function DanmarkKort() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredKode = useRef<string | null>(null);
  const valgtKodeRef = useRef<string | null>(null);
  const soegRef = useRef<HTMLDivElement | null>(null);
  const valgteRegionerRef = useRef<Selection>(new Set<string>());
  const valgteGrupperRef = useRef<Selection>(new Set<string>());
  const kommuneRegionerRef = useRef<Map<string, string>>(new Map());

  const [kommuner, setKommuner] = useState<Kommune[]>([]);
  const [valgtKode, setValgtKode] = useState<string | null>(null);
  const [soegning, setSoegning] = useState("");
  const [forslagAabent, setForslagAabent] = useState(false);
  const [klar, setKlar] = useState(false);
  const [visning, setVisning] = useState<Visning>("oversigt");
  const [valgteRegioner, setValgteRegioner] = useState<Selection>(new Set<string>());
  const [valgteGrupper, setValgteGrupper] = useState<Selection>(new Set<string>());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: KORT_STYLE,
      bounds: DANMARK_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      maxBounds: MAX_BOUNDS,
      attributionControl: false,
    });

    map.setMinZoom(map.getZoom());
    map.doubleClickZoom.disable();

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", async () => {
      const accent = "#2f6f4f";

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
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "valgt"], false],
            accent,
            ["boolean", ["feature-state", "hover"], false],
            accent,
            "#f7f4ee",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "valgt"], false],
            0.55,
            ["boolean", ["feature-state", "hover"], false],
            0.3,
            ["boolean", ["feature-state", "udenforFilter"], false],
            0.08,
            0.9,
          ],
        },
      });

      map.setPaintProperty("kommune-fill", "fill-opacity-transition", {
        duration: 400,
        delay: 0,
      });

      map.addLayer({
        id: "kommune-linje",
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#7a8a86",
          "line-width": 1,
        },
      });

      const res = await fetch(KOMMUNER_URL);
      const data: GeoJSON.FeatureCollection = await res.json();

      const liste: Kommune[] = [];
      data.features.forEach((feature) => {
        const kode = feature.properties?.kode as string;
        const navn = feature.properties?.navn as string;
        const regionskode = feature.properties?.regionskode as string;
        liste.push({ kode, navn, regionskode });
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
            { source: SOURCE_ID, id: hoveredKode.current },
            { hover: false },
          );
          hoveredKode.current = null;
        }
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      if (hoveredKode.current && hoveredKode.current !== kode) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredKode.current },
          { hover: false },
        );
      }
      if (hoveredKode.current !== kode) {
        map.setFeatureState({ source: SOURCE_ID, id: kode }, { hover: true });
        hoveredKode.current = kode;
      }
    });

    map.on("mouseleave", "kommune-fill", () => {
      map.getCanvas().style.cursor = "";
      if (hoveredKode.current) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredKode.current },
          { hover: false },
        );
        hoveredKode.current = null;
      }
    });

    map.on("click", "kommune-fill", (e) => {
      const feature = e.features?.[0];
      const kode = feature?.properties?.kode as string | undefined;
      const navn = feature?.properties?.navn as string | undefined;
      if (!kode || !erKommuneTilladt(kode)) return;
      setValgtKode(kode);
      if (navn) setSoegning(navn);
    });

    mapRef.current = map;

    return () => {
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
      valgtKodeRef.current = null;
    }

    if (valgtKode) {
      map.setFeatureState({ source: SOURCE_ID, id: valgtKode }, { valgt: true });
      valgtKodeRef.current = valgtKode;
    }
  }, [valgtKode, klar]);

  useEffect(() => {
    valgteRegionerRef.current = valgteRegioner;
    valgteGrupperRef.current = valgteGrupper;

    const map = mapRef.current;
    if (!map || !klar) return;

    const omrFilterAktiv = valgteRegioner !== "all" && valgteRegioner.size > 0;
    const omrIds = omrFilterAktiv ? [...valgteRegioner].map(String) : [];

    const grpFilterAktiv = valgteGrupper !== "all" && valgteGrupper.size > 0;
    const grpIds = grpFilterAktiv ? [...valgteGrupper].map(String) : [];

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
    });
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
    const map = mapRef.current;
    if (!map || visning !== "kort" || !klar) return;

    map.resize();

    if (!valgtKode) {
      map.setMinZoom(0);
      map.fitBounds(DANMARK_BOUNDS, { padding: 24, duration: 0 });
      map.setMinZoom(map.getZoom());
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

  const matcherRegion = (k: Kommune) =>
    !regionFilterAktiv ||
    [...valgteRegioner].some((id) =>
      kommuneMatcherFilterId(k.kode, k.regionskode, String(id)),
    );

  const matcherGruppe = (k: Kommune) =>
    !gruppeFilterAktiv ||
    [...valgteGrupper].some((id) => kommuneMatcherGruppeId(k.kode, String(id)));

  const matcherFiltre = (k: Kommune) => matcherRegion(k) && matcherGruppe(k);

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
      .filter((k) => (q ? k.navn.toLowerCase().includes(q) : true));
  }, [kommuner, soegning, valgteRegioner, valgteGrupper]);

  const kommunerRegionFiltreret = useMemo(
    () => kommuner.filter((k) => matcherFiltre(k)),
    [kommuner, valgteRegioner, valgteGrupper],
  );

  const rangAf = (kode: string) =>
    kommunerRegionFiltreret.findIndex((k) => k.kode === kode) + 1;

  const valgtKommune = kommuner.find((k) => k.kode === valgtKode) ?? null;
  const valgtKommuneRang = valgtKommune ? rangAf(valgtKommune.kode) : 0;

  const vaelgKommune = (k: Kommune) => {
    setValgtKode(k.kode);
    setSoegning(k.navn);
    setForslagAabent(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
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
          <Dropdown>
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-lg text-sm"
            >
              <IconFilter className="h-4 w-4" />
              Område
              {regionFilterAktiv && (
                <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/15 px-1 text-xs font-medium text-accent">
                  {valgteRegioner.size}
                </span>
              )}
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
              {gruppeFilterAktiv && (
                <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/15 px-1 text-xs font-medium text-accent">
                  {valgteGrupper.size}
                </span>
              )}
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

          <Button
            variant="outline"
            className="h-10 gap-1.5 rounded-lg text-sm"
          >
            <IconAdjustmentsHorizontal className="h-4 w-4" />
            Prioritet
          </Button>
        </div>
      </div>

      <div
        className={`relative h-[520px] overflow-hidden rounded-[1.75rem] border border-border shadow-sm sm:h-[620px] lg:h-[740px] ${
          visning === "kort" ? "" : "hidden"
        }`}
      >
        <div ref={containerRef} className="h-full w-full" />
        {!klar && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-secondary">
            <Spinner />
            <p className="text-sm text-muted">Indlæser kort…</p>
          </div>
        )}

        {klar && valgtKommune && (
          <div className="absolute right-14 top-4 z-10 w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg sm:w-72">
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
            <div className="p-3.5 pl-16">
              <p className="font-medium text-foreground">{valgtKommune.navn}</p>
              <p className="mt-0.5 text-xs text-muted">
                {REGION_NAVNE[valgtKommune.regionskode] ?? "Ukendt region"}
              </p>
            </div>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 border-t border-border bg-accent/10 py-2.5 text-xs font-medium text-accent transition-colors duration-200 hover:bg-accent/20"
            >
              <IconFileText className="h-3.5 w-3.5" />
              Se fuld rapport
            </button>
          </div>
        )}
      </div>

      {visning === "oversigt" && (
        <div className="flex h-[550px] flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm sm:h-[650px] lg:h-[770px]">
        <div className="h-5 shrink-0" />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-2">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kommunerFiltreret.map((k) => (
              <div
                key={k.kode}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 hover:-translate-y-1 hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setValgtKode(k.kode)}
                  className="flex-1 text-left"
                >
                  <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-surface-secondary to-accent/10">
                    <KommuneBillede
                      kode={k.kode}
                      navn={k.navn}
                      ikonClassName="h-8 w-8 text-muted/50"
                    />
                    <span
                      className={`absolute -bottom-4 left-3 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-md ring-4 ring-surface ${rankFarve(
                        rangAf(k.kode),
                      )}`}
                    >
                      {rangAf(k.kode)}.
                    </span>
                  </div>
                  <div className="p-3.5 pl-16">
                    <p className="font-medium text-foreground">{k.navn}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {REGION_NAVNE[k.regionskode] ?? "Ukendt region"}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setValgtKode(k.kode)}
                  className="flex items-center justify-center gap-1.5 border-t border-border bg-accent/10 py-2.5 text-xs font-medium text-accent transition-colors duration-200 hover:bg-accent/20"
                >
                  <IconFileText className="h-3.5 w-3.5" />
                  Se fuld rapport
                </button>
              </div>
            ))}

            {kommunerFiltreret.length === 0 && (
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
            )}
          </div>
        </div>
        <div className="h-5 shrink-0" />
        </div>
      )}

      {visning === "regneark" && (
        <div className="h-[520px] overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm sm:h-[620px] lg:h-[740px]">
        <div className="h-full overflow-y-auto">
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
        </div>
      )}
    </div>
  );
}
