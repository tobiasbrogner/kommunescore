// Kommunetesten (/kommunetest): 20 spørgsmål, der bliver til en Prioritet (vægte og
// nøgletalsvalg som på /kort) og et område. Svarene regnes om til en score for hver
// kommune i området, og de bedste vises som brugerens top 6.
//
// Nogle spørgsmål vises kun, når de giver mening (fx prisen på børnepasning kun for
// dem med børn), så testen kan være lidt kortere end 20 spørgsmål.

import { landsdelForKommune } from "@/lib/kommuner/omraader";
import { omvendtScore, type KategoriMeta, type KommuneScore } from "@/lib/scores/compute";
import { NOEGLETAL_VALG } from "@/lib/scores/noegletal-valg";
import type { GemtPrioritet } from "@/lib/scores/prioritet-link";

export type Svar = Record<string, string | string[] | number>;

export type Mulighed = { id: string; label: string; tekst?: string };

type Faelles = {
  id: string;
  /** Afsnittet, spørgsmålet hører til, fx "Bolig og økonomi". */
  afsnit: string;
  titel: string;
  hjaelp?: string | ((svar: Svar) => string | undefined);
  /** Mangler den, vises spørgsmålet altid. */
  vis?: (svar: Svar) => boolean;
};

export type Spoergsmaal =
  | (Faelles & {
      type: "valg";
      /** Flere kan vælges; så skal man trykke Næste. */
      flere?: boolean;
      muligheder: Mulighed[] | ((svar: Svar, kategorier: KategoriMeta[]) => Mulighed[]);
    })
  | (Faelles & {
      type: "vigtighed";
      /** Kategoriens slug; ikonet hentes fra kategorien. */
      kategori: string;
    });

// Vigtighed går fra 0 til 100 i trin på 25 og bliver direkte til kategoriens vægt.
export const VIGTIGHED_TRIN = [
  "Ligegyldigt",
  "Lidt vigtigt",
  "Middel",
  "Vigtigt",
  "Meget vigtigt",
] as const;
export const VIGTIGHED_STANDARD = 50;

export const OMRAADER: (Mulighed & { matcher: (kode: string, regionskode: string) => boolean })[] = [
  {
    id: "hovedstaden",
    label: "Hovedstadsområdet",
    tekst: "København, Nordsjælland og Bornholm",
    matcher: (_, r) => r === "1084",
  },
  {
    id: "sjaelland",
    label: "Resten af Sjælland",
    tekst: "Midt-, Vest- og Sydsjælland, Lolland og Falster",
    matcher: (_, r) => r === "1085",
  },
  {
    id: "fyn",
    label: "Fyn og øerne",
    tekst: "Odense, Svendborg, Langeland og Ærø",
    matcher: (k, r) => landsdelForKommune(k, r) === "fyn",
  },
  {
    id: "sydjylland",
    label: "Syd- og Sønderjylland",
    tekst: "Esbjerg, Vejle, Kolding og Sønderborg",
    matcher: (k, r) => r === "1083" && landsdelForKommune(k, r) === "jylland",
  },
  {
    id: "midtjylland",
    label: "Midtjylland",
    tekst: "Aarhus, Herning, Viborg og Holstebro",
    matcher: (_, r) => r === "1082",
  },
  {
    id: "nordjylland",
    label: "Nordjylland",
    tekst: "Aalborg, Hjørring, Thisted og Frederikshavn",
    matcher: (_, r) => r === "1081",
  },
];
export const HELE_LANDET = "hele-landet";

// Øer uden fast forbindelse til resten af landet.
const OEER_UDEN_BRO = new Set(["0400", "0825", "0741", "0563", "0492"]);

// Det, en kommune er god til, kort sagt (til "Passer til dig, fordi ...").
const STYRKE_TEKST: Record<string, string> = {
  boligpriser: "Lave boligpriser",
  kommuneskat: "Lav skat",
  boern: "Billig børnepasning",
  jobmuligheder: "Mange job",
  pendling: "Kort pendling",
  tryghed: "Tryghed",
  sundhed: "Sundhed",
  aeldre: "Ældrepleje",
  natur: "Natur",
  spisesteder: "Spisesteder",
  idraet: "Idræt og fritid",
  indbyggertal: "Byliv",
};

const ja = (svar: Svar, id: string, vaerdi: string) => svar[id] === vaerdi;
const vigtighed = (svar: Svar, id: string) =>
  typeof svar[id] === "number" ? (svar[id] as number) : VIGTIGHED_STANDARD;

export const SPOERGSMAAL: Spoergsmaal[] = [
  // Område
  {
    id: "omraade",
    afsnit: "Hvor i landet",
    type: "valg",
    flere: true,
    titel: "Hvor i landet kunne du bo?",
    hjaelp: "Vælg alle de områder, du kan forestille dig. Vi foreslår kun kommuner herfra.",
    muligheder: [
      ...OMRAADER.map(({ id, label, tekst }) => ({ id, label, tekst })),
      { id: HELE_LANDET, label: "Hele landet", tekst: "Jeg er åben over for alt" },
    ],
  },
  {
    id: "oe",
    afsnit: "Hvor i landet",
    type: "valg",
    titel: "Kunne du bo på en ø uden bro?",
    hjaelp: "Bornholm, Samsø, Læsø, Fanø og Ærø kræver færge eller fly.",
    muligheder: [
      { id: "ja", label: "Ja, gerne", tekst: "Øerne må gerne komme med" },
      { id: "nej", label: "Nej", tekst: "Jeg vil kunne køre over en bro" },
    ],
  },
  {
    id: "sted",
    afsnit: "Hvor i landet",
    type: "valg",
    titel: "Hvilket slags sted drømmer du om?",
    muligheder: [
      { id: "storby", label: "Storbyen", tekst: "Liv, mange mennesker og alt inden for rækkevidde" },
      { id: "provinsby", label: "En større provinsby", tekst: "Det meste tæt på, men lidt mere luft" },
      { id: "mindre-by", label: "En mindre by", tekst: "Overskueligt og nært" },
      { id: "landet", label: "På landet", tekst: "Ro, plads og langt til naboen" },
      { id: "ligegyldigt", label: "Det er lige meget" },
    ],
  },

  // Bolig og økonomi
  {
    id: "bolig",
    afsnit: "Bolig og økonomi",
    type: "valg",
    titel: "Hvad skal du bo i?",
    muligheder: [
      { id: "hus", label: "Hus eller rækkehus", tekst: "Jeg vil eje mit eget hus" },
      { id: "lejlighed", label: "Ejerlejlighed" },
      { id: "leje", label: "Lejebolig", tekst: "Andel eller leje" },
      { id: "ved-ikke", label: "Ved ikke endnu" },
    ],
  },
  {
    id: "boligpriser",
    afsnit: "Bolig og økonomi",
    type: "vigtighed",
    kategori: "boligpriser",
    titel: "Hvor vigtigt er det, at boligerne er billige?",
    hjaelp: (svar) =>
      ja(svar, "bolig", "leje")
        ? "Vi har kun købspriser, men de giver et godt billede af, hvor dyrt det er at bo."
        : "Pris pr. m² for de boliger, der er solgt i kommunen.",
  },
  {
    id: "kommuneskat",
    afsnit: "Bolig og økonomi",
    type: "vigtighed",
    kategori: "kommuneskat",
    titel: "Hvor meget betyder en lav skat?",
    hjaelp: (svar) =>
      ja(svar, "bolig", "leje")
        ? "Kommuneskatten af din indkomst."
        : "Kommuneskatten af din indkomst og grundskylden, som boligejere betaler.",
  },

  // Familie og arbejde
  {
    id: "boern",
    afsnit: "Familie og arbejde",
    type: "valg",
    titel: "Har du børn under 10 år, eller er de på vej?",
    muligheder: [
      { id: "ja", label: "Ja" },
      { id: "nej", label: "Nej" },
    ],
  },
  {
    id: "boernepasning",
    afsnit: "Familie og arbejde",
    type: "vigtighed",
    kategori: "boern",
    titel: "Hvor vigtig er prisen på børnepasning?",
    hjaelp: "Dagpleje, vuggestue, børnehave og SFO.",
    // Tæller med, indtil man har svaret nej, så antallet af spørgsmål ikke vokser undervejs.
    vis: (svar) => !ja(svar, "boern", "nej"),
  },
  {
    id: "arbejde",
    afsnit: "Familie og arbejde",
    type: "valg",
    titel: "Hvordan ser din arbejdssituation ud?",
    muligheder: [
      { id: "soeger", label: "Jeg skal finde arbejde", tekst: "Gerne i kommunen eller tæt på" },
      { id: "rart", label: "Det er rart med mange job", tekst: "Hvis jeg skulle skifte en dag" },
      { id: "har", label: "Jeg har arbejde", tekst: "Eller arbejder mest hjemmefra" },
      { id: "pension", label: "Jeg er på pension" },
    ],
  },
  {
    id: "pendling",
    afsnit: "Familie og arbejde",
    type: "vigtighed",
    kategori: "pendling",
    titel: "Hvor vigtigt er kort vej til arbejde?",
    hjaelp: "Hvor langt folk i kommunen pendler i gennemsnit.",
    vis: (svar) => !ja(svar, "arbejde", "pension"),
  },

  // Tryghed og sundhed
  {
    id: "tryghed",
    afsnit: "Tryghed og sundhed",
    type: "vigtighed",
    kategori: "tryghed",
    titel: "Hvor vigtigt er det med lav kriminalitet?",
    hjaelp: "Indbrud i boliger samt vold og røveri pr. 1.000 indbyggere.",
  },
  {
    id: "sundhed",
    afsnit: "Tryghed og sundhed",
    type: "vigtighed",
    kategori: "sundhed",
    titel: "Hvor vigtigt er læge tæt på og et langt liv?",
    hjaelp: "Afstand til nærmeste læge og middellevetiden i kommunen.",
  },
  {
    id: "aeldre",
    afsnit: "Tryghed og sundhed",
    type: "vigtighed",
    kategori: "aeldre",
    titel: "Hvor vigtig er ældreplejen for dig?",
    hjaelp: "Ventetid på plejebolig og hjemmehjælp, fx for dig selv eller dine forældre.",
  },

  // Fritid
  {
    id: "natur",
    afsnit: "Fritid",
    type: "vigtighed",
    kategori: "natur",
    titel: "Hvor vigtig er natur?",
    hjaelp: "Skov, strand, enge og andre grønne områder.",
  },
  {
    id: "naturtype",
    afsnit: "Fritid",
    type: "valg",
    titel: "Hvilken slags natur?",
    vis: (svar) => vigtighed(svar, "natur") > 0,
    muligheder: [
      { id: "andel", label: "Grønt omkring mig", tekst: "En grøn kommune i hverdagen" },
      { id: "pr-indbygger", label: "Masser af plads", tekst: "Meget natur at dele og få mennesker" },
      { id: "begge", label: "Begge dele" },
    ],
  },
  {
    id: "spisesteder",
    afsnit: "Fritid",
    type: "vigtighed",
    kategori: "spisesteder",
    titel: "Hvor vigtigt er restauranter og caféer?",
  },
  {
    id: "spisetype",
    afsnit: "Fritid",
    type: "valg",
    titel: "Hvad leder du efter?",
    vis: (svar) => vigtighed(svar, "spisesteder") > 0,
    muligheder: [
      { id: "antal", label: "Et stort udvalg", tekst: "Som i en større by" },
      { id: "pr-indbygger", label: "Gode steder tæt på", tekst: "Også i en mindre by" },
      { id: "begge", label: "Begge dele" },
    ],
  },
  {
    id: "idraet",
    afsnit: "Fritid",
    type: "vigtighed",
    kategori: "idraet",
    titel: "Hvor vigtigt er sport og foreningsliv?",
  },
  {
    id: "idraettype",
    afsnit: "Fritid",
    type: "valg",
    titel: "Hvad betyder mest?",
    vis: (svar) => vigtighed(svar, "idraet") > 0,
    muligheder: [
      { id: "medlemmer", label: "Foreningslivet", tekst: "Fællesskab og mange, der er med" },
      { id: "anlaeg", label: "Gode faciliteter", tekst: "Haller, baner og svømmehaller" },
      { id: "begge", label: "Begge dele" },
    ],
  },

  // Til sidst
  {
    id: "vigtigst",
    afsnit: "Til sidst",
    type: "valg",
    titel: "Hvis du kun måtte vælge én ting, hvad skulle det så være?",
    hjaelp: "Den tæller mest i din top 6.",
    muligheder: (svar, kategorier) => [
      ...kategorier
        .filter((k) => (byggPrioritet(svar, kategorier).vaegte[k.slug] ?? 0) > 0)
        .map((k) => ({ id: k.slug, label: STYRKE_TEKST[k.slug] ?? k.navn })),
      { id: "ingen", label: "Kan ikke vælge" },
    ],
  },
];

/** De spørgsmål, der vises med de svar, brugeren har givet indtil nu. */
export function synligeSpoergsmaal(svar: Svar) {
  return SPOERGSMAAL.filter((s) => !s.vis || s.vis(svar));
}

// Et delt resultat (Del-knappen): hvert svar er en parameter med spørgsmålets id, fx
// ?omraade=midtjylland_fyn&sted=provinsby&boligpriser=75. Flere valg skilles med "_",
// som ingen af mulighedernes id'er indeholder. Resultatet regnes ud fra svarene, så linket
// giver samme top 6, så længe tallene er de samme.
const SVAR_LISTE = "_";

export function svarTilParametre(svar: Svar) {
  const params = new URLSearchParams();
  for (const s of SPOERGSMAAL) {
    const v = svar[s.id];
    if (v === undefined) continue;
    params.set(s.id, Array.isArray(v) ? v.join(SVAR_LISTE) : String(v));
  }
  return params;
}

/** Svarene fra et delt link, eller null, når linket ikke er et resultat (intet område).
 * Ukendte spørgsmål og muligheder springes over, fx fra et link til en ældre udgave. */
export function svarFraParametre(params: URLSearchParams, kategorier: KategoriMeta[]): Svar | null {
  const svar: Svar = {};
  // I spørgsmålenes rækkefølge, da mulighederne til "vigtigst" afhænger af de tidligere svar.
  for (const s of SPOERGSMAAL) {
    const raa = params.get(s.id);
    if (raa === null || raa === "") continue;
    if (s.type === "vigtighed") {
      const tal = Number(raa);
      if (Number.isFinite(tal)) svar[s.id] = Math.min(100, Math.max(0, Math.round(tal / 25) * 25));
      continue;
    }
    const muligheder = typeof s.muligheder === "function" ? s.muligheder(svar, kategorier) : s.muligheder;
    const kendt = new Set(muligheder.map((m) => m.id));
    if (s.flere) {
      const ider = [...new Set(raa.split(SVAR_LISTE))].filter((id) => kendt.has(id));
      if (ider.length > 0) svar[s.id] = ider;
    } else if (kendt.has(raa)) {
      svar[s.id] = raa;
    }
  }
  return svar.omraade ? svar : null;
}

/** Fjerner et delt resultats parametre fra en adresse (resten bliver stående). */
export function fjernSvarParametre(params: URLSearchParams) {
  for (const s of SPOERGSMAAL) params.delete(s.id);
}

export type TestPrioritet = GemtPrioritet & {
  /** Kommuner, der kan komme med (null = alle). */
  omraader: string[] | null;
  udenOeer: boolean;
};

/** Svarene som en Prioritet med vægte 0-100 i trin på 5, så den også kan åbnes på /kort. */
export function byggPrioritet(svar: Svar, kategorier: KategoriMeta[]): TestPrioritet {
  const vaegte: Record<string, number> = {};
  const noegletal: Record<string, string[]> = {};
  const valg = (slug: string, ider: string[]) => {
    // Kun id'er, kortet kender, så linket til /kort viser det samme.
    const kendte = ider.filter((id) => NOEGLETAL_VALG[slug]?.some((v) => v.id === id));
    if (kendte.length > 0) noegletal[slug] = kendte;
  };

  // Hvilket slags sted: byen belønner mange indbyggere, landet få pr. km².
  const sted = svar.sted;
  if (sted === "storby") {
    vaegte.indbyggertal = 75;
    valg("indbyggertal", ["antal", "taethed"]);
  } else if (sted === "provinsby") {
    vaegte.indbyggertal = 40;
    valg("indbyggertal", ["antal"]);
  } else if (sted === "mindre-by") {
    vaegte.indbyggertal = 25;
    valg("indbyggertal", ["lav-taethed"]);
  } else if (sted === "landet") {
    vaegte.indbyggertal = 75;
    valg("indbyggertal", ["lav-taethed"]);
  } else {
    vaegte.indbyggertal = 0;
  }

  // Bolig: kun den boligtype, man vil købe. Lejere betaler ikke grundskyld, og
  // købspriserne siger mindre om deres husleje, så de tæller halvt.
  const lejer = svar.bolig === "leje";
  if (svar.bolig === "hus") valg("boligpriser", ["hus"]);
  if (svar.bolig === "lejlighed") valg("boligpriser", ["lejlighed"]);
  if (lejer) valg("kommuneskat", ["kommuneskat"]);
  vaegte.boligpriser = afrund(vigtighed(svar, "boligpriser") * (lejer ? 0.5 : 1));
  vaegte.kommuneskat = vigtighed(svar, "kommuneskat");

  vaegte.boern = ja(svar, "boern", "ja") ? vigtighed(svar, "boernepasning") : 0;

  const arbejde = svar.arbejde;
  vaegte.jobmuligheder =
    arbejde === "soeger" ? 100 : arbejde === "rart" ? 60 : arbejde === "har" ? 20 : arbejde === "pension" ? 0 : 50;
  vaegte.pendling = arbejde === "pension" ? 0 : vigtighed(svar, "pendling");

  for (const slug of ["tryghed", "sundhed", "aeldre", "natur", "spisesteder", "idraet"]) {
    vaegte[slug] = vigtighed(svar, slug);
  }
  const type = (id: string, slug: string) => {
    const v = svar[id];
    if (typeof v === "string" && v !== "begge") valg(slug, [v]);
  };
  if (vaegte.natur > 0) type("naturtype", "natur");
  if (vaegte.spisesteder > 0) type("spisetype", "spisesteder");
  if (vaegte.idraet > 0) type("idraettype", "idraet");

  // Det vigtigste får fuld vægt, og resten tæller lidt mindre.
  const vigtigst = svar.vigtigst;
  if (typeof vigtigst === "string" && vigtigst in vaegte) {
    for (const slug of Object.keys(vaegte)) {
      vaegte[slug] = slug === vigtigst ? 100 : afrund(vaegte[slug] * 0.8);
    }
  }

  // Kun kendte kategorier; ukendte vægte ville ikke tælle på kortet alligevel.
  const slugs = new Set(kategorier.map((k) => k.slug));
  for (const slug of Object.keys(vaegte)) if (!slugs.has(slug)) delete vaegte[slug];

  const valgteOmraader = Array.isArray(svar.omraade) ? svar.omraade : [];
  return {
    vaegte,
    fra: [],
    noegletal,
    omraader:
      valgteOmraader.length === 0 || valgteOmraader.includes(HELE_LANDET) ? null : valgteOmraader,
    udenOeer: svar.oe === "nej",
  };
}

function afrund(vaegt: number) {
  return Math.min(100, Math.max(0, Math.round(vaegt / 5) * 5));
}

export type TestKommune = { kode: string; regionskode: string };

export type Match = {
  kode: string;
  score: number;
  /** Op til tre ting, kommunen er god til blandt det, brugeren vægter højt. */
  styrker: string[];
};

/** Kommunerne i området sorteret efter, hvor godt de passer til svarene. */
export function findMatch(
  prioritet: TestPrioritet,
  kategorier: KategoriMeta[],
  scorer: KommuneScore[],
  kommuner: TestKommune[],
): Match[] {
  const regionPrKode = new Map(kommuner.map((k) => [k.kode, k.regionskode]));
  const omraader = prioritet.omraader
    ? OMRAADER.filter((o) => prioritet.omraader!.includes(o.id))
    : null;

  // De nøgletal, der tæller i kategorien (som valgteNoegletal på /kort); undefined = standard.
  const valgte = new Map(
    kategorier.map((kat) => {
      const ider = prioritet.noegletal[kat.slug];
      if (!ider) return [kat.id, undefined] as const;
      const noegletal = (NOEGLETAL_VALG[kat.slug] ?? [])
        .filter((v) => ider.includes(v.id))
        .flatMap((v) => {
          const id = kat.noegletal.find((n) => n.navn === v.noegletal)?.id;
          return id === undefined ? [] : [{ id, omvendt: v.omvendt === true }];
        });
      return [kat.id, noegletal] as const;
    }),
  );

  const kategoriScore = (s: KommuneScore, kat: KategoriMeta): number | null => {
    const noegletal = valgte.get(kat.id);
    if (!noegletal) return s.kategorier[kat.id] ?? null;
    const tal = noegletal.flatMap(({ id, omvendt }) => {
      const score = s.noegletal[id];
      if (score === undefined) return [];
      return [omvendt ? omvendtScore(score, kat.venlighed) : score];
    });
    return tal.length > 0 ? tal.reduce((a, b) => a + b, 0) / tal.length : null;
  };

  const matches = scorer.flatMap((s) => {
    const regionskode = regionPrKode.get(s.kode);
    if (prioritet.udenOeer && OEER_UDEN_BRO.has(s.kode)) return [];
    if (omraader && (!regionskode || !omraader.some((o) => o.matcher(s.kode, regionskode)))) {
      return [];
    }

    let sum = 0;
    let vaegtSum = 0;
    const bidrag: { slug: string; score: number; vaegt: number }[] = [];
    for (const kat of kategorier) {
      const vaegt = prioritet.vaegte[kat.slug] ?? 0;
      if (vaegt <= 0) continue;
      const score = kategoriScore(s, kat);
      if (score === null) continue;
      sum += score * vaegt;
      vaegtSum += vaegt;
      bidrag.push({ slug: kat.slug, score, vaegt });
    }
    const score = vaegtSum > 0 ? sum / vaegtSum : s.samlet;

    // Styrker: kategorier, brugeren gav mindst middel vægt, hvor kommunen scorer højt.
    const landliv = prioritet.noegletal.indbyggertal?.includes("lav-taethed");
    const styrker = bidrag
      .filter((b) => b.vaegt >= VIGTIGHED_STANDARD && b.score >= 75)
      .sort((a, b) => b.score * b.vaegt - a.score * a.vaegt)
      .slice(0, 3)
      .map((b) =>
        b.slug === "indbyggertal" && landliv ? "Ro og plads" : (STYRKE_TEKST[b.slug] ?? b.slug),
      );

    return [{ kode: s.kode, score, styrker }];
  });

  return matches.sort((a, b) => b.score - a.score);
}
