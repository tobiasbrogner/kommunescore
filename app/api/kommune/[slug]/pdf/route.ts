import puppeteer, { type Browser } from "puppeteer";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { hentKommuneRapport } from "@/lib/scores/kommune-rapport";

// Kommunerapporten som PDF-fil ("Gem som PDF" på rapporten). En skjult Chrome åbner
// selve rapportsiden med print-stylingen fra globals.css, så PDF'en ligner udskriften
// 1:1 og har rigtig, markérbar tekst.

// Chrome er dyr at starte, så én instans deles mellem forespørgsler og genstartes kun,
// hvis den er gået ned.
let browserLoefte: Promise<Browser> | null = null;

function hentBrowser() {
  if (!browserLoefte) {
    browserLoefte = puppeteer.launch({ headless: true }).then((browser) => {
      browser.on("disconnected", () => {
        browserLoefte = null;
      });
      return browser;
    });
    browserLoefte.catch(() => {
      browserLoefte = null;
    });
  }
  return browserLoefte;
}

export async function GET(request: Request, ctx: RouteContext<"/api/kommune/[slug]/pdf">) {
  const { slug } = await ctx.params;
  const rapport = await hentKommuneRapport(slug);
  if (!rapport) {
    return Response.json({ fejl: "Kommunen findes ikke." }, { status: 404 });
  }

  // APP_URL frem for Host-headeren, så en forfalsket header ikke kan sende Chrome
  // hen til en anden server.
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  const rapportSlug = kommuneSlug(rapport.navn);

  const browser = await hentBrowser();
  const side = await browser.newPage();
  try {
    await side.emulateMediaType("print");
    await side.goto(`${appUrl}/kommune/${rapportSlug}`, {
      waitUntil: "networkidle0",
      timeout: 30_000,
    });
    await side.evaluate(() => document.fonts.ready);

    const pdf = await side.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="kommunerapport-${rapportSlug}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await side.close();
  }
}
