import { kommuneSlug } from "@/lib/kommuner/slug";

// Boligsidens side med boliger til salg i kommunen, fx
// https://www.boligsiden.dk/kommune/aarhus/tilsalg. Boligsiden skriver kommunenavnene som
// vores adresser (æ, ø og å som ae, oe og aa); alle 98 er tjekket 2026-10-08. Et ukendt navn
// giver ingen fejl, men viser hele Danmark, så tjek igen, hvis en kommune skifter navn.
//
// UTM-parametrene viser Boligsiden i deres egen statistik, at besøget kommer fra Kommuna,
// og fra hvilket sted på siden (kampagnen).
export function boligsidenLink(navn: string, kampagne: "kommunerapport" | "kort") {
  const parametre = new URLSearchParams({
    utm_source: "kommuna",
    utm_medium: "referral",
    utm_campaign: kampagne,
  });
  return `https://www.boligsiden.dk/kommune/${kommuneSlug(navn)}/tilsalg?${parametre}`;
}
