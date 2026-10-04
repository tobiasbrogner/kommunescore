import {
  BORNHOLM_RAMME,
  BORNHOLM_STI,
  DANMARK_BREDDE,
  DANMARK_HOEJDE,
  DANMARK_STI,
  DANMARK_VIEWBOX,
} from "@/lib/danmarkskort";
import { ForsideHuse, type ForsideHus } from "@/components/forside-huse";

// Billedet øverst på forsiden: Jylland, Fyn, Sjælland, Lolland og Falster som én rolig
// flade og Bornholm i en ramme i hjørnet (genereret af scripts/byg-danmarkskort.ts), med
// huse på nogle eksempelkommuner. Kortet tegnes på serveren; kun husene er interaktive.

// Farverne blandes af tekst- og baggrundsfarven, så landet står lige tydeligt i lyst og
// mørkt tema.
const LAND = "color-mix(in oklch, var(--foreground) 9%, var(--background))";
const KYST = "color-mix(in oklch, var(--foreground) 24%, var(--background))";
export function ForsideKort({ huse }: { huse: ForsideHus[] }) {
  return (
    <figure className="mx-auto w-full max-w-[520px]">
      <div className="relative w-full" style={{ aspectRatio: `${DANMARK_BREDDE} / ${DANMARK_HOEJDE}` }}>
        <svg viewBox={DANMARK_VIEWBOX} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d={DANMARK_STI} fill={LAND} stroke={KYST} strokeWidth={2.5} strokeLinejoin="round" />
          <rect
            x={BORNHOLM_RAMME.x}
            y={BORNHOLM_RAMME.y}
            width={BORNHOLM_RAMME.bredde}
            height={BORNHOLM_RAMME.hoejde}
            rx={14}
            fill="none"
            stroke={KYST}
            strokeWidth={2}
          />
          <path d={BORNHOLM_STI} fill={LAND} stroke={KYST} strokeWidth={2.5} strokeLinejoin="round" />
        </svg>
        <ForsideHuse huse={huse} />
      </div>
    </figure>
  );
}
