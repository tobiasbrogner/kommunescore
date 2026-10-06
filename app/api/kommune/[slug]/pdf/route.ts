import { createHash } from "node:crypto";
import puppeteer, { type Browser } from "puppeteer";
import { kommuneSlug } from "@/lib/kommuner/slug";
import { hentKommuneRapport } from "@/lib/scores/kommune-rapport";

// Kommunerapporten som PDF-fil ("Gem som PDF" på rapporten). En skjult Chrome åbner
// selve rapportsiden med print-stylingen fra globals.css, så PDF'en ligner udskriften
// 1:1 og har rigtig, markérbar tekst.
//
// Hver PDF tager flere sekunder og en Chrome-fane at lave, så serveren ikke må lave
// mange på én gang: PDF'en er den samme for alle, så de senest brugte gemmes, højst
// MAKS_SAMTIDIGE laves ad gangen, og står for mange i kø, bedes man prøve igen.

// Højst så mange PDF'er laves samtidig; resten venter i kø.
const MAKS_SAMTIDIGE = 2;
// Står flere end så mange i kø, afvises nye med 503 i stedet for at hobe sig op.
const MAKS_I_KOE = 10;
// En PDF fylder ca. 1,5 MB, så kun de senest brugte gemmes (ca. 30 MB).
const MAKS_GEMTE = 20;

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

// slug -> den gemte PDF og den version af rapporten, den er lavet ud fra. Map'en holder
// rækkefølgen, så den ældste (først i Map'en) fjernes, når der er for mange.
const gemte = new Map<string, { version: string; pdf: Buffer }>();
// version -> PDF, der er ved at blive lavet, så samtidige forespørgsler deler arbejdet.
const igang = new Map<string, Promise<Buffer>>();

class KoeenErFuld extends Error {}

// Simpel kø: højst MAKS_SAMTIDIGE kører ad gangen. Når én er færdig, gives pladsen
// direkte videre til den næste i køen.
let aktive = 0;
const koe: (() => void)[] = [];

async function medPlads<T>(arbejde: () => Promise<T>): Promise<T> {
  if (aktive < MAKS_SAMTIDIGE) {
    aktive++;
  } else {
    if (koe.length >= MAKS_I_KOE) throw new KoeenErFuld();
    await new Promise<void>((klar) => koe.push(klar));
  }
  try {
    return await arbejde();
  } finally {
    const naeste = koe.shift();
    if (naeste) naeste();
    else aktive--;
  }
}

async function lavPdf(adresse: string): Promise<Buffer> {
  const browser = await hentBrowser();
  const side = await browser.newPage();
  try {
    await side.emulateMediaType("print");
    await side.goto(adresse, { waitUntil: "networkidle0", timeout: 30_000 });
    await side.evaluate(() => document.fonts.ready);
    const pdf = await side.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await side.close();
  }
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

  // Rapportens indhold bestemmer versionen: ændres tallene eller teksterne (fx i
  // admin-panelet), laves en ny PDF. Ændres sidens udseende, genstartes serveren alligevel.
  const version = createHash("sha256").update(JSON.stringify(rapport)).digest("hex");

  let pdf: Buffer;
  const gemt = gemte.get(rapportSlug);
  if (gemt?.version === version) {
    pdf = gemt.pdf;
    // Flyt den bagerst, så den senest brugte er den sidste, der fjernes.
    gemte.delete(rapportSlug);
    gemte.set(rapportSlug, gemt);
  } else {
    let arbejde = igang.get(version);
    if (!arbejde) {
      arbejde = medPlads(() => lavPdf(`${appUrl}/kommune/${rapportSlug}`)).finally(() =>
        igang.delete(version),
      );
      igang.set(version, arbejde);
    }
    try {
      pdf = await arbejde;
    } catch (fejl) {
      if (fejl instanceof KoeenErFuld) {
        return Response.json(
          { fejl: "Der laves mange PDF'er lige nu. Prøv igen om lidt." },
          { status: 503, headers: { "Retry-After": "10" } },
        );
      }
      throw fejl;
    }
    gemte.delete(rapportSlug);
    gemte.set(rapportSlug, { version, pdf });
    if (gemte.size > MAKS_GEMTE) gemte.delete(gemte.keys().next().value!);
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kommunerapport-${rapportSlug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
