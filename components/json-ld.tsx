import { siteAdresse } from "@/lib/site-adresse";

// Strukturerede data (JSON-LD), som Google bruger til at vise sidens navn og en sti
// (fx Kommuna › Kommuner › Aarhus Kommune) i søgeresultaterne. Kan testes med
// https://search.google.com/test/rich-results eller https://validator.schema.org.
// "<" kodes, så en tekst i dataene aldrig kan afslutte <script>-tagget.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Stien til siden, fx [["Kommuner", "/kommuner"], ["Aarhus Kommune", "/kommune/aarhus"]].
 * Forsiden (Kommuna) kommer altid først. */
export function Broedkrummer({ sti }: { sti: [navn: string, adresse: string][] }) {
  const adresse = siteAdresse();
  return (
    <JsonLd
      data={{
        "@type": "BreadcrumbList",
        itemListElement: [["Kommuna", "/"] as const, ...sti].map(([navn, sti], i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: navn,
          item: `${adresse}${sti}`,
        })),
      }}
    />
  );
}
