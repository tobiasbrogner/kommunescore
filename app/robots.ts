import type { MetadataRoute } from "next";
import { siteAdresse } from "@/lib/site-adresse";

// Søgemaskiner må det hele undtagen admin-panelet og API'et.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/panel", "/api/"],
    },
    sitemap: `${siteAdresse()}/sitemap.xml`,
  };
}
