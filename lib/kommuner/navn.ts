// Kommunens officielle navn, fx "Aarhus" → "Aarhus Kommune". Nogle få kommuner
// hedder noget andet end blot "[navn] Kommune".
const SAERLIGE_NAVNE: Record<string, string> = {
  København: "Københavns Kommune",
  Bornholm: "Bornholms Regionskommune",
};

export function officieltKommunenavn(navn: string) {
  return SAERLIGE_NAVNE[navn] ?? `${navn} Kommune`;
}
