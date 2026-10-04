// Kommunens officielle navn, fx "Aarhus" → "Aarhus Kommune". Nogle få kommuner
// hedder noget andet end blot "[navn] Kommune".
const SAERLIGE_NAVNE: Record<string, string> = {
  København: "Københavns Kommune",
  Bornholm: "Bornholms Regionskommune",
};

export function officieltKommunenavn(navn: string) {
  return SAERLIGE_NAVNE[navn] ?? `${navn} Kommune`;
}

// Kommunenavne i alfabetisk rækkefølge på dansk, men med "aa" som to a'er: Aarhus og
// Aabenraa står under A (hvor folk leder efter dem) og Faaborg før Fanø, mens Æ, Ø og Å
// stadig kommer sidst. Dansk sortering læser ellers "aa" som "å".
const ADSKIL_AA = (navn: string) => navn.replace(/aa/gi, (aa) => `${aa[0]}​${aa[1]}`);

export function sammenlignKommunenavne(a: string, b: string) {
  return ADSKIL_AA(a).localeCompare(ADSKIL_AA(b), "da");
}
