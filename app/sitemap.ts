import type { MetadataRoute } from "next";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { getCachedRapportData } from "@/lib/scores/get-scores";
import { siteAdresse } from "@/lib/site-adresse";

// Alle offentlige sider, så søgemaskiner finder de 98 kommunerapporter. Admin-panelet
// og API'et er udeladt (og afvist i robots.txt).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const adresse = siteAdresse();
  const { kommuner } = await getCachedRapportData();

  const faste: MetadataRoute.Sitemap = [
    { url: `${adresse}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${adresse}/kort`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${adresse}/sammenlign`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${adresse}/saadan-virker-det`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${adresse}/kilder`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const rapporter: MetadataRoute.Sitemap = kommuner
    .map((k) => kommuneSlug(k.navn))
    .sort()
    .map((slug) => ({
      url: `${adresse}/kommune/${slug}`,
      changeFrequency: "monthly",
      priority: 0.8,
    }));

  return [...faste, ...rapporter];
}
