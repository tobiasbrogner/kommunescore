import "server-only";

// Den besøgendes IP-adresse til grænserne for login, chat, feedback og adressesøgning.
//
// Bag hostingens proxy står adressen i X-Forwarded-For. Feltet er en liste, hvor hver
// proxy tilføjer den adresse, den modtog forbindelsen fra, bagerst. Alt foran kan den
// besøgende selv skrive, så den første adresse kan forfalskes (og blev brugt til at omgå
// grænserne). Derfor tælles bagfra: med én proxy er den sidste adresse den rigtige.
// Står der flere proxyer foran siden (fx et CDN foran hostingen), sættes antallet med
// TRUSTED_PROXY_HOPS.
//
// Lokalt er der ingen proxy, så headeren kan sættes frit; det betyder kun noget for test.
const PROXY_HOPS = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

export function klientIp(request: Request): string {
  const liste = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return liste[liste.length - PROXY_HOPS] ?? liste[0] ?? "ukendt";
}
