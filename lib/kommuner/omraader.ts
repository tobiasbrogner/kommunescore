import { REGION_NAVNE } from "@/lib/kommuner/regioner";

// Landsdele og kommunegrupper til Område- og Gruppe-filtrene på /kort. Bruges også
// af AI-chatten, så den filtrerer præcis som kortet.

export const LANDSDEL_NAVNE: Record<string, string> = {
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

export function landsdelForKommune(kode: string, regionskode: string): string {
  if (regionskode === "1081" || regionskode === "1082") return "jylland";
  if (regionskode === "1083") return FYN_KOMMUNE_KODER.has(kode) ? "fyn" : "jylland";
  return "sjaelland";
}

export function kommuneMatcherFilterId(kode: string, regionskode: string, filterId: string) {
  if (filterId in REGION_NAVNE) return regionskode === filterId;
  return landsdelForKommune(kode, regionskode) === filterId;
}

// Danmarks Statistiks kommunegruppering, se
// https://www.dst.dk/da/Statistik/dokumentation/nomenklaturer/kommunegrupper
export const GRUPPE_NAVNE: Record<string, string> = {
  "1": "Hovedstadskommuner",
  "2": "Storbykommuner",
  "3": "Provinsbykommuner",
  "4": "Oplandskommuner",
  "5": "Landkommuner",
};

export const GRUPPE_BESKRIVELSE: Record<string, string> = {
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

export function gruppeForKommune(kode: string): string | undefined {
  return KOMMUNE_GRUPPE_ID.get(kode);
}

export function kommuneMatcherGruppeId(kode: string, gruppeId: string) {
  return KOMMUNE_GRUPPE_ID.get(kode) === gruppeId;
}
