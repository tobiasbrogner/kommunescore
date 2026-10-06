import { NextResponse, type NextRequest } from "next/server";
import { erAdresseRateLimited } from "@/lib/auth/rate-limit";
import { klientIp } from "@/lib/klient-ip";

// Adressesøgning til den personlige afstand på /kort. Slår op i Dataforsyningens Gsearch
// (det officielle adresseregister, afløseren for DAWA), der kræver en gratis token i
// GSEARCH_TOKEN. Svarer Gsearch ikke, eller mangler token'en, bruges Photon
// (OpenStreetMap) som reserve, så feltet altid virker.
// Opslaget går via serveren, så tjenesten kan skiftes uden at røre klienten.
// Svarer med op til 6 forslag: { tekst, lat, lon }.

type Forslag = { tekst: string; lat: number; lon: number };

const MAKS_FORSLAG = 6;

// --- Gsearch -------------------------------------------------------------------------

const GSEARCH = "https://api.dataforsyningen.dk/rest/gsearch/v2.0";

type GsearchGeometri = { type: string; coordinates: unknown };
type GsearchResultat = { visningstekst?: string; geometri?: GsearchGeometri | null };

/** Midten af geometriens afgrænsende kasse — stednavne er ofte flader eller linjer. */
function midtpunkt(geometri: GsearchGeometri): { lon: number; lat: number } | null {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const besoeg = (v: unknown) => {
    if (!Array.isArray(v)) return;
    if (typeof v[0] === "number" && typeof v[1] === "number") {
      minLon = Math.min(minLon, v[0]);
      maxLon = Math.max(maxLon, v[0]);
      minLat = Math.min(minLat, v[1]);
      maxLat = Math.max(maxLat, v[1]);
    } else {
      v.forEach(besoeg);
    }
  };
  besoeg(geometri.coordinates);
  if (!Number.isFinite(minLon)) return null;
  return { lon: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2 };
}

async function gsearch(ressource: string, q: string, token: string, limit: number): Promise<Forslag[]> {
  const url = `${GSEARCH}/${ressource}?q=${encodeURIComponent(q)}&limit=${limit}&srid=4326&token=${token}`;
  const svar = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!svar.ok) throw new Error(`Gsearch ${ressource}: HTTP ${svar.status}`);
  const resultater = (await svar.json()) as GsearchResultat[];
  return resultater.flatMap((r) => {
    const punkt = r.geometri && midtpunkt(r.geometri);
    return r.visningstekst && punkt ? [{ tekst: r.visningstekst, ...punkt }] : [];
  });
}

/** Husnumre (adresser uden etage og dør) først, så stednavne som "Aarhus Universitet". */
async function soegGsearch(q: string, token: string): Promise<Forslag[]> {
  const [husnumre, stednavne] = await Promise.allSettled([
    gsearch("husnummer", q, token, MAKS_FORSLAG),
    gsearch("stednavn", q, token, 3),
  ]);
  if (husnumre.status === "rejected" && stednavne.status === "rejected") throw husnumre.reason;
  const h = husnumre.status === "fulfilled" ? husnumre.value : [];
  const s = stednavne.status === "fulfilled" ? stednavne.value : [];
  // Giv stednavnene mindst to pladser, når der er nok af begge slags.
  return [...h.slice(0, MAKS_FORSLAG - Math.min(2, s.length)), ...s];
}

// --- Photon (reserve) ----------------------------------------------------------------

const PHOTON = "https://photon.komoot.io/api/";
const DANMARK_BBOX = "7.5,54.5,15.3,57.8";
const HEADERS = { "User-Agent": "Kommuna/0.1 (kommunescore; https://github.com/tobiasbrogner/kommunescore)" };

type PhotonFeature = {
  properties: {
    countrycode?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
  };
  geometry: { coordinates: [number, number] };
};

function photonTekst({ properties: p }: PhotonFeature) {
  const sted = [p.postcode, p.city ?? p.district].filter(Boolean).join(" ");
  const vej = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : undefined;
  // Stednavnet (fx en virksomhed eller station) står først, når det ikke bare er vejen.
  const navn = p.name && p.name !== p.street ? p.name : undefined;
  return [navn, vej, sted].filter(Boolean).join(", ");
}

async function soegPhoton(q: string): Promise<Forslag[]> {
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=10&lang=default&bbox=${DANMARK_BBOX}`;
  const svar = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(4000) });
  if (!svar.ok) throw new Error(`Photon: HTTP ${svar.status}`);
  const features = ((await svar.json()).features ?? []) as PhotonFeature[];
  return features
    .filter((f) => f.properties.countrycode === "DK")
    .map((f) => ({ tekst: photonTekst(f), lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
}

// --- Route ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) return NextResponse.json([]);

  if (erAdresseRateLimited(klientIp(request))) {
    return NextResponse.json({ fejl: "For mange søgninger. Prøv igen om lidt." }, { status: 429 });
  }

  let forslag: Forslag[] | null = null;
  const token = process.env.GSEARCH_TOKEN;
  if (token) {
    forslag = await soegGsearch(q, token).catch((err) => {
      console.warn(`Gsearch fejlede, bruger Photon: ${err instanceof Error ? err.message : err}`);
      return null;
    });
  }
  forslag ??= await soegPhoton(q).catch(() => null);
  if (!forslag) {
    return NextResponse.json({ fejl: "Adressesøgningen svarer ikke lige nu." }, { status: 502 });
  }

  return NextResponse.json(
    forslag
      .filter((f, i, alle) => f.tekst && alle.findIndex((a) => a.tekst === f.tekst) === i)
      .slice(0, MAKS_FORSLAG),
  );
}
