import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { billedKredit } from "@/lib/kommuner/billeder";
import { officieltKommunenavn } from "@/lib/kommuner/navn";
import { hentKommuneRapport } from "@/lib/scores/kommune-rapport";

// Delebillede for en kommunerapport (vises fx på Facebook og i Messenger): kommunens foto
// til venstre og logo, navn, region og samlet score til højre. Kommuner uden foto får en
// farveflade i stedet.

export const alt = "Kommunerapport fra Kommuna";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BAGGRUND = "#f9f8f4";
const TEKST = "#1c1b22";
const DAEMPET = "#6b6878";
const ACCENT = "#5b21e6";

// Sidens skrift, Geist, i almindelig og halvfed vægt (overskrifterne på siden er halvfede).
// ImageResponse kan ikke læse woff2, så filerne ligger som ttf i lib/og.
async function geist() {
  const mappe = path.join(process.cwd(), "lib/og");
  const [normal, halvfed] = await Promise.all([
    readFile(path.join(mappe, "Geist-Regular.ttf")),
    readFile(path.join(mappe, "Geist-SemiBold.ttf")),
  ]);
  return [
    { name: "Geist", data: normal, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: halvfed, weight: 600 as const, style: "normal" as const },
  ];
}

async function dataUrl(fil: string, type: string) {
  return `data:${type};base64,${(await readFile(fil)).toString("base64")}`;
}

export default async function Billede({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rapport = await hentKommuneRapport(slug);
  const fonts = await geist();
  const logo = await dataUrl(path.join(process.cwd(), "public/brand/kommuna-logo.svg"), "image/svg+xml");

  if (!rapport) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: BAGGRUND, alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse kender kun <img>. */}
          <img src={logo} alt="" width={540} height={120} />
        </div>
      ),
      { ...size, fonts },
    );
  }

  const fotoFil = path.join(process.cwd(), "public/kommuner", `${rapport.kode}.jpg`);
  const foto = existsSync(fotoFil) ? await dataUrl(fotoFil, "image/jpeg") : null;
  // CC-licenserne kræver fotograf og licens, også når fotoet deles; som i rapporten.
  const kredit = foto ? billedKredit(rapport.kode) : null;
  const kreditTekst =
    kredit &&
    `Foto: ${kredit.fotograf}, ${kredit.licens}${/^(CC0|Public domain|PD)/i.test(kredit.licens) ? "" : " (beskåret)"}`;
  const score = Math.round(rapport.samlet.score);
  const navn = officieltKommunenavn(rapport.navn);
  // Lange navne (fx "Bornholms Regionskommune") får mindre skrift, så de ikke løber ud.
  const navnStoerrelse = navn.length > 20 ? 58 : 72;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: BAGGRUND, fontFamily: "Geist" }}>
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 520,
            height: "100%",
            background: "linear-gradient(135deg, #ece9f8, #d9cff7)",
          }}
        >
          {foto && (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse kender kun <img>.
            <img src={foto} alt="" width={520} height={630} style={{ objectFit: "cover" }} />
          )}
          {kreditTekst && (
            <div
              style={{
                display: "flex",
                position: "absolute",
                left: 12,
                bottom: 12,
                maxWidth: 496,
                padding: "4px 10px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.55)",
                color: "rgba(255,255,255,0.92)",
                fontSize: 16,
              }}
            >
              {kreditTekst}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "56px 64px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse kender kun <img>. */}
          <img src={logo} alt="" width={252} height={56} />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, color: ACCENT }}>Kommunerapport</div>
            <div
              style={{
                fontSize: navnStoerrelse,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: TEKST,
                lineHeight: 1.05,
                marginTop: 8,
              }}
            >
              {navn}
            </div>
            {rapport.regionNavn && (
              <div style={{ fontSize: 30, color: DAEMPET, marginTop: 12 }}>{rapport.regionNavn}</div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 132,
                height: 132,
                borderRadius: 999,
                background: ACCENT,
                color: "white",
                fontSize: 60,
                fontWeight: 600,
              }}
            >
              {score}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 28 }}>
              <div style={{ fontSize: 34, fontWeight: 600, color: TEKST }}>Samlet score</div>
              <div style={{ fontSize: 28, color: DAEMPET, marginTop: 4 }}>
                {`Nr. ${rapport.samlet.rang} af ${rapport.samlet.antal} kommuner`}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
