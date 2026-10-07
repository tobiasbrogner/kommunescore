import path from "node:path";
import { ImageResponse } from "next/og";
import { deltTop } from "@/lib/kommunetest-server";
import { dataUrl, DELEBILLEDE_STOERRELSE, geist, OG_FARVER, somJpeg } from "@/lib/og/billede";

// Delebillede for kommunetesten (vises fx i Messenger og på Facebook): en lilla flade med
// logo og "Min top 6" til venstre og kommunerne med placering og score til højre. Svarene
// står i adressen som på /kommunetest (se svarTilParametre); uden svar et generelt billede.

const { tekst: TEKST, daempet: DAEMPET, accent: ACCENT, baggrund: BAGGRUND } = OG_FARVER;
const FLADE_BREDDE = 430;
// Placeringernes farver som på kortet (guld, sølv, bronze); resten i sidens accent.
const PLADS_FARVE = ["#e5a50a", "#9aa0a6", "#c26a2e"];

export async function GET(request: Request) {
  const top = await deltTop(new URL(request.url).searchParams);
  const [fonts, logo] = await Promise.all([
    geist(),
    dataUrl(path.join(process.cwd(), "public/brand/kommuna-logo-hvid.svg"), "image/svg+xml"),
  ]);
  const harTop = top !== null && top.length > 0;

  const flade = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: FLADE_BREDDE,
        height: "100%",
        padding: "56px 52px",
        background: `linear-gradient(160deg, ${ACCENT}, #3a0f9e)`,
        color: "white",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse kender kun <img>. */}
      <img src={logo} alt="" width={234} height={52} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, opacity: 0.85 }}>Kommunetesten</div>
        <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.02, marginTop: 10 }}>
          {harTop ? `Min top ${top.length}` : "Find din kommune"}
        </div>
      </div>
      <div style={{ fontSize: 24, lineHeight: 1.35, opacity: 0.85 }}>
        {harTop ? "Tag testen selv på 3 minutter" : "20 korte spørgsmål om, hvor og hvordan du vil bo"}
      </div>
    </div>
  );

  const indhold = harTop ? (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "40px 56px" }}>
      {top.map((k, i) => (
        <div
          key={k.kode}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "13px 0",
            borderTop: i === 0 ? "none" : "2px solid #e8e5dc",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: 999,
              background: PLADS_FARVE[i] ?? ACCENT,
              color: "white",
              fontSize: 26,
              fontWeight: 600,
            }}
          >
            {i + 1}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 24 }}>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 600, color: TEKST, lineHeight: 1.1 }}>{k.navn}</div>
            {k.region && <div style={{ display: "flex", fontSize: 20, color: DAEMPET, marginTop: 2 }}>{k.region}</div>}
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: TEKST }}>{Math.round(k.score)}</div>
        </div>
      ))}
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "56px 64px" }}>
      <div style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-0.025em", color: TEKST, lineHeight: 1.1 }}>
        De seks kommuner, der passer bedst til dig
      </div>
      <div style={{ fontSize: 28, color: DAEMPET, marginTop: 24, lineHeight: 1.4 }}>
        Ud fra tal for alle 98 kommuner: boligpriser, skat, natur, tryghed og meget mere.
      </div>
    </div>
  );

  return somJpeg(
    new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: BAGGRUND, fontFamily: "Geist" }}>
          {flade}
          {indhold}
        </div>
      ),
      { ...DELEBILLEDE_STOERRELSE, fonts },
    ),
    // Billedet afhænger kun af svarene og tallene, som sjældent ændres.
    { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" },
  );
}
