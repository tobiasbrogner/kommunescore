import { NextResponse, type NextRequest } from "next/server";
import { erAdresseRateLimited } from "@/lib/auth/rate-limit";

// Adressesøgning til den personlige afstand på /kort. Slår op i Photon (OpenStreetMap),
// der er gratis og uden nøgle; DAWA er lukket, og afløseren Gsearch kræver en token.
// Opslaget går via serveren, så tjenesten kan skiftes uden at røre klienten.
// Svarer med op til 6 forslag: { tekst, lat, lon }.

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

function tekst({ properties: p }: PhotonFeature) {
  const sted = [p.postcode, p.city ?? p.district].filter(Boolean).join(" ");
  const vej = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : undefined;
  // Stednavnet (fx en virksomhed eller station) står først, når det ikke bare er vejen.
  const navn = p.name && p.name !== p.street ? p.name : undefined;
  return [navn, vej, sted].filter(Boolean).join(", ");
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) return NextResponse.json([]);

  const ip = request.headers.get("x-forwarded-for") ?? "ukendt";
  if (erAdresseRateLimited(ip)) {
    return NextResponse.json({ fejl: "For mange søgninger. Prøv igen om lidt." }, { status: 429 });
  }

  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=10&lang=default&bbox=${DANMARK_BBOX}`;
  const svar = await fetch(url, { headers: HEADERS }).catch(() => null);
  if (!svar?.ok) {
    return NextResponse.json({ fejl: "Adressesøgningen svarer ikke lige nu." }, { status: 502 });
  }

  const features = ((await svar.json()).features ?? []) as PhotonFeature[];
  const forslag = features
    .filter((f) => f.properties.countrycode === "DK")
    .map((f) => ({ tekst: tekst(f), lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
    .filter((f, i, alle) => f.tekst && alle.findIndex((a) => a.tekst === f.tekst) === i)
    .slice(0, 6);

  return NextResponse.json(forslag);
}
