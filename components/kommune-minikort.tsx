import kommunePunkter from "@/data/kommune-punkter.json";
import {
  BORNHOLM_RAMME,
  BORNHOLM_STI,
  DANMARK_BREDDE,
  DANMARK_HOEJDE,
  DANMARK_STI,
  DANMARK_VIEWBOX,
  projekterTilDanmarkskort,
} from "@/lib/danmarkskort";

// Lille Danmarkskort på kommunesiden med en prik, hvor kommunen ligger (ved dens største
// by, data/kommune-punkter.json). Samme kystlinje som forsidens kort; Bornholm
// står i en ramme i hjørnet, og projekterTilDanmarkskort flytter selv punkter dertil.
// Tegnes på serveren som ren SVG.

// Lidt kraftigere end på forsiden, så det lille kort også står tydeligt i mørkt tema.
const LAND = "color-mix(in oklch, var(--foreground) 14%, var(--background))";
const KYST = "color-mix(in oklch, var(--foreground) 32%, var(--background))";
const punkter = kommunePunkter as Record<string, { by: string; lat: number; lon: number }>;

export function KommuneMinikort({
  kode,
  navn,
  region,
}: {
  kode: string;
  navn: string;
  region: string | null;
}) {
  const punkt = punkter[kode];
  if (!punkt) return null;
  const [x, y] = projekterTilDanmarkskort(punkt.lon, punkt.lat);
  const beskrivelse = `Kort over Danmark, der viser, hvor ${navn} ligger${region ? ` i ${region}` : ""}.`;

  return (
    <div
      className="relative mx-auto w-full max-w-[11rem]"
      style={{ aspectRatio: `${DANMARK_BREDDE} / ${DANMARK_HOEJDE}` }}
    >
      <svg viewBox={DANMARK_VIEWBOX} className="absolute inset-0 h-full w-full" role="img" aria-label={beskrivelse}>
        <path d={DANMARK_STI} fill={LAND} stroke={KYST} strokeWidth={4} strokeLinejoin="round" />
        <rect
          x={BORNHOLM_RAMME.x}
          y={BORNHOLM_RAMME.y}
          width={BORNHOLM_RAMME.bredde}
          height={BORNHOLM_RAMME.hoejde}
          rx={14}
          fill="none"
          stroke={KYST}
          strokeWidth={3}
        />
        <path d={BORNHOLM_STI} fill={LAND} stroke={KYST} strokeWidth={4} strokeLinejoin="round" />
        {/* Prikken med en blød ring om, så den kan ses på både lyst og mørkt tema. */}
        <circle cx={x} cy={y} r={60} fill="var(--accent)" opacity={0.18} />
        <circle cx={x} cy={y} r={30} fill="var(--accent)" stroke="var(--background)" strokeWidth={8} />
      </svg>
    </div>
  );
}
