import type { Metadata } from "next";
import { Kommunetest } from "@/components/kommunetest";
import { deltTop, hentKommunetestData, somSoegeparametre } from "@/lib/kommunetest-server";
import { svarTilParametre, svarFraParametre } from "@/lib/kommunetest";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";

const TITEL = "Kommunetesten | Kommuna";
const BESKRIVELSE =
  "Svar på 20 korte spørgsmål om, hvor og hvordan du vil bo, og find de seks kommuner, der passer bedst til dig.";

// Et delt resultat (/kommunetest?omraade=...) får sin top 6 i titlen og et delebillede med
// listen (app/kommunetest/billede), så linket viser resultatet, når det sendes. Ellers et
// generelt billede for testen.
export async function generateMetadata(props: PageProps<"/kommunetest">): Promise<Metadata> {
  const params = somSoegeparametre(await props.searchParams);
  const top = await deltTop(params);
  if (!top || top.length === 0) {
    return {
      title: TITEL,
      description: BESKRIVELSE,
      openGraph: { title: TITEL, description: BESKRIVELSE, images: ["/kommunetest/billede"] },
      twitter: { card: "summary_large_image" },
    };
  }
  // Kun svarene i billedets adresse (ikke fx sporingsparametre), så det kan caches.
  const { kategorier } = await getCachedKommuneScores();
  const svar = svarTilParametre(svarFraParametre(params, kategorier)!);
  const title = `Min top ${top.length} i Kommunetesten: ${top.map((k) => k.navn).join(", ")}`;
  const description = "Se kommunerne, der passer bedst til svarene, og tag testen selv på 3 minutter.";
  return {
    title,
    description,
    // Det delte resultat skal ikke i søgeresultaterne som en side for sig.
    robots: { index: false },
    alternates: { canonical: "/kommunetest" },
    openGraph: { title, description, images: [`/kommunetest/billede?${svar}`] },
    twitter: { card: "summary_large_image" },
  };
}

export default async function KommunetestSide() {
  const { kategorier, scorer, kommuner } = await hentKommunetestData();
  return <Kommunetest kategorier={kategorier} scorer={scorer} kommuner={kommuner} />;
}
