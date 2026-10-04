// Sidens offentlige adresse, fx https://kommuna.dk. Sættes med APP_URL hos hostingen;
// lokalt bruges dev-serveren. Bruges til sitemap, robots.txt og fulde adresser i delinger.
export function siteAdresse() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
