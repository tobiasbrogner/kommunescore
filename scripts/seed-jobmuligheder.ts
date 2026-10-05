import "./_load-env";

import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import kommunePunkter from "@/data/kommune-punkter.json";
import { db } from "@/lib/db";
import { kategorier, kommuner, kommuneNoegletal, noegletal } from "@/lib/db/schema";
import { revaliderScores } from "./_revalider";

const KATEGORI_NAVN = "Jobmuligheder";
const KATEGORI_SLUG = "jobmuligheder";

const JOB_FIL = "data/kilder/job-pr-1000-indbyggere-2024.xlsx";

// Job inden for pendlingsafstand: alle landets job, vægtet med exp(-afstand / HENFALD_KM)
// efter afstanden i fugleflugt mellem kommunernes største byer. Et job 25 km væk tæller
// ca. en tredjedel, 50 km væk en ottendedel. Så får forstæder til store byer de mange job
// i nabokommunen med, og universitetsbyer trækkes ikke ned af de mange studerende, som
// erhvervsfrekvensen og ledigheden gør.
const HENFALD_KM = 25;

type Kilde = {
  navn: string;
  enhed: string;
  retning: "hoejere_bedre" | "lavere_bedre";
  skala: "lineaer" | "logaritmisk";
  // Tæller i kategoriens standardscore; ellers et tilvalg under Prioritet på /kort.
  standardValgt: boolean;
  beskrivelse: string;
  // Værdier efter kommunenavn.
  vaerdier: () => Map<string, number>;
};

/** Læser (navn, værdi)-par fra første ark. Rækker der ikke er kommuner
 * (regioner, landsdele, "Hele landet", noter) frasorteres af kalderen, som kun
 * beholder navne der findes i kommuner-tabellen. */
function laesVaerdier(fil: string, navneKolonne: number, vaerdiKolonne: number) {
  const arbejdsbog = XLSX.readFile(path.join(process.cwd(), fil));
  const ark = arbejdsbog.Sheets[arbejdsbog.SheetNames[0]];
  const raa = XLSX.utils.sheet_to_json(ark, { header: 1, raw: true }) as unknown[][];

  const vaerdier = new Map<string, number>();
  for (const linje of raa) {
    const navn = linje[navneKolonne];
    const vaerdi = linje[vaerdiKolonne];
    if (typeof navn === "string" && typeof vaerdi === "number") {
      vaerdier.set(navn.trim(), vaerdi);
    }
  }
  return vaerdier;
}

function afstandKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Job inden for pendlingsafstand pr. kommune (se HENFALD_KM), afrundet til 100. */
function jobIndenForPendlingsafstand(alleKommuner: { kode: string; navn: string }[]) {
  const job = laesVaerdier(JOB_FIL, 0, 1);
  const punkter = kommunePunkter as Record<string, { lat: number; lon: number }>;
  const medJob = alleKommuner.map((k) => {
    const punkt = punkter[k.kode];
    const antal = job.get(k.navn);
    if (!punkt || antal === undefined) throw new Error(`Mangler punkt eller job for ${k.navn}`);
    return { navn: k.navn, punkt, antal };
  });

  return new Map(
    medJob.map((k) => {
      const sum = medJob.reduce(
        (acc, j) => acc + j.antal * Math.exp(-afstandKm(k.punkt, j.punkt) / HENFALD_KM),
        0,
      );
      return [k.navn, Math.round(sum / 100) * 100];
    }),
  );
}

function kilder(alleKommuner: { kode: string; navn: string }[]): Kilde[] {
  return [
    {
      navn: "Job inden for pendlingsafstand",
      enhed: "job",
      retning: "hoejere_bedre",
      // Logaritmisk, så hovedstadsområdets mange job ikke presser resten af landet i bund.
      skala: "logaritmisk",
      standardValgt: true,
      beskrivelse: `Arbejdspladser ultimo november 2024 i kommunen og omegnen (Danmarks Statistik, ERHV2). Job i andre kommuner tæller mindre, jo længere væk de ligger: et job ${HENFALD_KM} km væk i fugleflugt fra kommunens største by tæller ca. en tredjedel. Flere job giver en højere score.`,
      vaerdier: () => jobIndenForPendlingsafstand(alleKommuner),
    },
    {
      navn: "Job pr. 1.000 indbyggere",
      enhed: "job",
      retning: "hoejere_bedre",
      skala: "lineaer",
      standardValgt: false,
      beskrivelse:
        "Antal arbejdspladser i kommunen ultimo november 2024 pr. 1.000 indbyggere (Danmarks Statistik, ERHV2 og FOLK1AM). Tallet viser, hvor mange job der ligger i kommunen, ikke hvor indbyggerne arbejder. Flere job giver en højere score.",
      vaerdier: () => laesVaerdier(JOB_FIL, 0, 3),
    },
    {
      navn: "Erhvervsfrekvens (16-64 år)",
      enhed: "%",
      retning: "hoejere_bedre",
      skala: "lineaer",
      standardValgt: false,
      beskrivelse:
        "Andelen af 16-64-årige, der er i arbejdsstyrken (i job eller ledige), opgjort ultimo november 2024 (Danmarks Statistik, RAS200). Studerende tæller ikke med i arbejdsstyrken, så universitetsbyer ligger lavt. En højere andel giver en højere score.",
      vaerdier: () => laesVaerdier("data/kilder/erhvervsfrekvens.xlsx", 4, 5),
    },
    {
      navn: "Ledighed (fuldtidsledige)",
      enhed: "%",
      retning: "lavere_bedre",
      skala: "lineaer",
      standardValgt: false,
      beskrivelse:
        "Fuldtidsledige i procent af arbejdsstyrken i 2024 (Danmarks Statistik, AULP01). En lavere ledighed giver en højere score.",
      vaerdier: () => laesVaerdier("data/kilder/ledighed.xlsx", 2, 3),
    },
  ];
}

async function main() {
  const alleKommuner = await db.select({ kode: kommuner.kode, navn: kommuner.navn }).from(kommuner);

  const [kategori] = await db
    .insert(kategorier)
    .values({
      navn: KATEGORI_NAVN,
      slug: KATEGORI_SLUG,
      ikon: "briefcase",
      standardvaegt: "1",
      sortering: 2,
    })
    .onConflictDoUpdate({ target: kategorier.slug, set: { navn: sql`excluded.navn` } })
    .returning();

  let antalVaerdier = 0;
  const alleKilder = kilder(alleKommuner);

  for (const kilde of alleKilder) {
    const vaerdier = kilde.vaerdier();

    const manglende = alleKommuner.filter((k) => !vaerdier.has(k.navn));
    if (manglende.length > 0) {
      throw new Error(`${kilde.navn}: mangler værdier for ${manglende.map((k) => k.navn).join(", ")}`);
    }

    const felter = {
      enhed: kilde.enhed,
      retning: kilde.retning,
      skala: kilde.skala,
      standardValgt: kilde.standardValgt,
      beskrivelse: kilde.beskrivelse,
    };

    // Genbrug eksisterende nøgletal ved genkørsel i stedet for at oprette dubletter.
    let [noegletalRow] = await db
      .select()
      .from(noegletal)
      .where(and(eq(noegletal.kategoriId, kategori.id), eq(noegletal.navn, kilde.navn)));
    if (!noegletalRow) {
      [noegletalRow] = await db
        .insert(noegletal)
        .values({ kategoriId: kategori.id, navn: kilde.navn, ...felter })
        .returning();
    } else {
      await db.update(noegletal).set(felter).where(eq(noegletal.id, noegletalRow.id));
    }

    for (const kommune of alleKommuner) {
      await db
        .insert(kommuneNoegletal)
        .values({
          kommuneKode: kommune.kode,
          noegletalId: noegletalRow.id,
          vaerdi: String(vaerdier.get(kommune.navn)),
        })
        .onConflictDoUpdate({
          target: [kommuneNoegletal.kommuneKode, kommuneNoegletal.noegletalId],
          set: { vaerdi: sql`excluded.vaerdi` },
        });
      antalVaerdier++;
    }
  }

  console.log(
    `Opdaterede kategorien "${KATEGORI_NAVN}" med ${alleKilder.length} nøgletal og ${antalVaerdier} værdier for ${alleKommuner.length} kommuner.`,
  );
  await revaliderScores();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
