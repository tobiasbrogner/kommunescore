"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button, Dropdown, Header, Label, Spinner, type Selection } from "@heroui/react";

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

function MapIkon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" strokeLinejoin="round" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function LukIkon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function OversigtIkon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <rect x="4" y="4" width="7" height="7" rx="1.3" />
      <rect x="13" y="4" width="7" height="7" rx="1.3" />
      <rect x="4" y="13" width="7" height="7" rx="1.3" />
      <rect x="13" y="13" width="7" height="7" rx="1.3" />
    </svg>
  );
}

function FilterIkon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="M4 5h16M7 12h10M10.5 19h3" strokeLinecap="round" />
    </svg>
  );
}

function rankFarve(rank: number) {
  if (rank === 1) return "bg-gradient-to-br from-amber-300 to-yellow-500 text-yellow-950";
  if (rank === 2) return "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900";
  if (rank === 3) return "bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950";
  return "bg-foreground text-surface";
}

function PrioritetIkon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="M4 18v-4M4 10V6M12 18v-8M12 6v-.01M20 18v-2M20 12V6" strokeLinecap="round" />
      <circle cx="4" cy="12" r="2" />
      <circle cx="12" cy="10" r="2" />
      <circle cx="20" cy="14" r="2" />
    </svg>
  );
}

function RegnearkIkon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 9.5h16M4 14.5h16M11.7 4v16" />
    </svg>
  );
}

const VISNINGER: { id: Visning; label: string; Ikon: () => React.JSX.Element }[] = [
  { id: "oversigt", label: "Oversigt", Ikon: OversigtIkon },
  { id: "kort", label: "Kort", Ikon: MapIkon },
  { id: "regneark", label: "Regneark", Ikon: RegnearkIkon },
];

export function DanmarkKort() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredKode = useRef<string | null>(null);
  const valgtKodeRef = useRef<string | null>(null);
  const soegRef = useRef<HTMLDivElement | null>(null);

  const [kommuner, setKommuner] = useState<Kommune[]>([]);
  const [valgtKode, setValgtKode] = useState<string | null>(null);
  const [soegning, setSoegning] = useState("");
  const [forslagAabent, setForslagAabent] = useState(false);
  const [klar, setKlar] = useState(false);
  const [visning, setVisning] = useState<Visning>("oversigt");
  const [valgteRegioner, setValgteRegioner] = useState<Selection>(new Set<string>());

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

      setKlar(true);
    });

    map.on("mousemove", "kommune-fill", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features?.[0];
      if (!feature) return;
      const kode = feature.properties?.kode as string;

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
      if (kode) setValgtKode(kode);
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
    const map = mapRef.current;
    if (!map || !klar) return;

    const filterAktiv = valgteRegioner !== "all" && valgteRegioner.size > 0;

    kommuner.forEach((k) => {
      const udenfor = filterAktiv && !valgteRegioner.has(k.regionskode);
      map.setFeatureState({ source: SOURCE_ID, id: k.kode }, { udenforFilter: udenfor });
    });
  }, [valgteRegioner, klar, kommuner]);

  const forsteRegionsRender = useRef(true);

  useEffect(() => {
    if (forsteRegionsRender.current) {
      forsteRegionsRender.current = false;
      return;
    }

    setValgtKode(null);
    setSoegning("");
  }, [valgteRegioner]);

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

  const matcherRegion = (k: Kommune) =>
    !regionFilterAktiv || valgteRegioner.has(k.regionskode);

  const forslag = useMemo(() => {
    const q = soegning.trim().toLowerCase();
    if (!q) return [];
    return kommuner
      .filter((k) => matcherRegion(k))
      .filter((k) => k.navn.toLowerCase().includes(q))
      .slice(0, 8);
  }, [kommuner, soegning, valgteRegioner]);

  const kommunerFiltreret = useMemo(() => {
    const q = soegning.trim().toLowerCase();
    return kommuner
      .filter((k) => matcherRegion(k))
      .filter((k) => (q ? k.navn.toLowerCase().includes(q) : true));
  }, [kommuner, soegning, valgteRegioner]);

  const kommunerRegionFiltreret = useMemo(
    () => kommuner.filter((k) => matcherRegion(k)),
    [kommuner, valgteRegioner],
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
              <FilterIkon />
              Region
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
                <Header>Region</Header>
                {Object.entries(REGION_NAVNE).map(([kode, navn]) => (
                  <Dropdown.Item key={kode} id={kode} textValue={navn}>
                    <Dropdown.ItemIndicator className="shrink-0">
                      {({ isSelected }) => (
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150 ${
                            isSelected
                              ? "border-accent bg-accent"
                              : "border-border bg-surface"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              viewBox="0 0 16 16"
                              className="h-2.5 w-2.5 text-white"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path
                                d="M3.5 8.5l3 3 6-6.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                      )}
                    </Dropdown.ItemIndicator>
                    <Label>{navn}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          <Button
            variant="outline"
            className="h-10 gap-1.5 rounded-lg text-sm"
          >
            <PrioritetIkon />
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                className="h-7 w-7 text-muted/50"
              >
                <path d="M4 21V8l8-4 8 4v13" strokeLinejoin="round" />
                <path d="M9 21v-6h6v6M4 21h16" />
              </svg>
              {valgtKommuneRang > 0 && (
                <span
                  className={`absolute -bottom-4 left-3 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-md ring-4 ring-surface ${rankFarve(
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
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-muted shadow-sm transition-colors duration-150 hover:text-foreground"
              >
                <LukIkon />
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="h-3.5 w-3.5"
              >
                <path d="M7 3h7l4 4v14H7z" strokeLinejoin="round" />
                <path d="M14 3v4h4M9 12h6M9 15.5h6M9 8.5h3" />
              </svg>
              Se fuld rapport
            </button>
          </div>
        )}
      </div>

      {visning === "oversigt" && (
        <div className="flex h-[520px] flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm sm:h-[620px] lg:h-[740px]">
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
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      className="h-8 w-8 text-muted/50"
                    >
                      <path d="M4 21V8l8-4 8 4v13" strokeLinejoin="round" />
                      <path d="M9 21v-6h6v6M4 21h16" />
                    </svg>
                    <span
                      className={`absolute -bottom-4 left-3 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-md ring-4 ring-surface ${rankFarve(
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
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M7 3h7l4 4v14H7z" strokeLinejoin="round" />
                    <path d="M14 3v4h4M9 12h6M9 15.5h6M9 8.5h3" />
                  </svg>
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
