import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "./providers";
import { siteAdresse } from "@/lib/site-adresse";
import { IkonProvider, type IkonKort } from "@/components/ikon";
import { ikonerFor } from "@/lib/ikoner";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";

// Kategoriernes ikoner slås op på serveren og sendes med til alle sider, så de står i
// HTML'en fra start. Svarer databasen ikke, henter ikonerne sig selv som før.
async function kategoriIkoner(): Promise<IkonKort> {
  try {
    const { kategorier } = await getCachedKommuneScores();
    return await ikonerFor(kategorier.map((k) => k.ikon));
  } catch {
    return {};
  }
}

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Gør relative adresser (fx delebilleder) til fulde adresser i delinger og søgeresultater.
  metadataBase: new URL(siteAdresse()),
  title: "Kommuna",
  description:
    "Find et sted i Danmark, der passer til dit liv.",
  openGraph: {
    siteName: "Kommuna",
    locale: "da_DK",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} flex min-h-screen flex-col bg-background text-foreground antialiased`}
      >
        <Providers>
          <IkonProvider ikoner={await kategoriIkoner()}>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </IkonProvider>
        </Providers>
      </body>
    </html>
  );
}