// Nøgletal, man kan vælge imellem i en kategori: under Prioritet på /kort og i
// kommunetesten (/kommunetest). Id'erne står også i delte links (se prioritet-link.ts).

// Personlig pendling: se medAfstandsNoegletal i components/danmark-kort.tsx.
export const PENDLING_SLUG = "pendling";
export const AFSTAND_NOEGLETAL = "Afstand til din adresse";
export const AFSTAND_VALG_ID = "min-adresse";

// Kategorier, hvor man under Prioritet kan vælge, hvilke nøgletal der tæller (efter
// kategoriens slug). Alle er valgt fra start, og så tæller kategorien som normalt.
// Kommuner uden en værdi for de valgte nøgletal springes over i kategorien i stedet
// for at få bundscoren; deres samlede score regnes så ud fra de øvrige kategorier.
// noegletal er nøgletallets navn i databasen; forklaring vises ved mus over knappen.
// omvendt vender nøgletallets score, så det modsatte er bedst. To valg med samme nøgletal
// kan ikke være valgt på én gang.
export type NoegletalValg = {
  id: string;
  label: string;
  forklaring: string;
  noegletal: string;
  omvendt?: boolean;
};
export const NOEGLETAL_VALG: Record<string, NoegletalValg[]> = {
  // Antal siger mest om kommunens størrelse; tætheden skelner byer fra store landkommuner.
  indbyggertal: [
    {
      id: "antal",
      label: "Antal",
      forklaring: "Antal indbyggere i kommunen",
      noegletal: "Indbyggere",
    },
    {
      id: "taethed",
      label: "Tæthed",
      forklaring: "Indbyggere pr. km²; skelner byer fra store landkommuner",
      noegletal: "Indbyggere pr. km²",
    },
    // Til dem, der søger ro: færre naboer giver højere score (bruges af Landliv og ro).
    {
      id: "lav-taethed",
      label: "Lav tæthed",
      forklaring: "Færre indbyggere pr. km² giver højere score; til dig, der søger ro",
      noegletal: "Indbyggere pr. km²",
      omvendt: true,
    },
  ],
  // Pr. indbygger alene giver små turistkommuner topscore; antallet viser bylivet.
  // Antal står først som under Indbyggertal, så det står samme sted i begge kategorier.
  spisesteder: [
    {
      id: "antal",
      label: "Antal",
      forklaring: "Spisesteder i alt i kommunen; viser hvor meget byliv der er",
      noegletal: "Spisesteder i alt",
    },
    {
      id: "pr-indbygger",
      label: "Pr. indbygger",
      forklaring: "Spisesteder pr. 1.000 indbyggere",
      noegletal: "Spisesteder pr. 1.000 indbyggere",
    },
  ],
  boligpriser: [
    {
      id: "hus",
      label: "Parcel/Rækkehus",
      forklaring: "Parcelhuse (villaer) og rækkehuse",
      noegletal: "Parcel-/rækkehus",
    },
    {
      id: "lejlighed",
      label: "Ejerlejlighed",
      forklaring: "Ejerlejligheder",
      noegletal: "Ejerlejlighed",
    },
  ],
  // Grundskyld betales kun af boligejere, så lejere kan fravælge den.
  kommuneskat: [
    {
      id: "kommuneskat",
      label: "Kommuneskat",
      forklaring: "Kommunal udskrivningsprocent (skat af indkomst)",
      noegletal: "Kommuneskat",
    },
    {
      id: "grundskyld",
      label: "Grundskyld",
      forklaring: "Grundskyldspromille; betales kun af boligejere",
      noegletal: "Grundskyldspromille",
    },
  ],
  // Andelen viser, hvor grøn kommunen er; pr. indbygger viser, hvor meget natur der er at dele.
  natur: [
    {
      id: "andel",
      label: "Andel",
      forklaring: "Andel af kommunens areal, der er natur og grønne områder",
      noegletal: "Andel natur og grønne områder",
    },
    {
      id: "pr-indbygger",
      label: "Pr. indbygger",
      forklaring: "Kvadratmeter natur pr. indbygger; tyndt befolkede kommuner ligger højt",
      noegletal: "Natur pr. indbygger",
    },
  ],
  // "Min adresse" findes kun, når man har skrevet en adresse i Pendling (se medAfstand).
  [PENDLING_SLUG]: [
    {
      id: "gennemsnit",
      label: "Gennemsnit",
      forklaring: "Hvor langt de beskæftigede i kommunen pendler i gennemsnit",
      noegletal: "Pendlingsafstand",
    },
    {
      id: AFSTAND_VALG_ID,
      label: "Min adresse",
      forklaring: "Afstand i fugleflugt fra kommunens største by til din adresse",
      noegletal: AFSTAND_NOEGLETAL,
    },
  ],
  // Foreningslivet og anlæggene kan vælges hver for sig; begge tæller fra start.
  idraet: [
    {
      id: "medlemmer",
      label: "Foreninger",
      forklaring: "Medlemskaber af idrætsforeninger i procent af befolkningen",
      noegletal: "Medlemskaber af idrætsforeninger",
    },
    {
      id: "anlaeg",
      label: "Anlæg",
      forklaring: "Idrætsanlæg pr. 10.000 indbyggere, fx haller, baner og svømmehaller",
      noegletal: "Idrætsanlæg pr. 10.000 indbyggere",
    },
  ],
  // Ventetiden er entydig; hjemmehjælpen kan også afspejle plejekrævende borgere, så den
  // kan fravælges. Begge tæller fra start.
  aeldre: [
    {
      id: "ventetid",
      label: "Plejebolig",
      forklaring: "Ventetid i dage på plejehjem eller plejebolig for 67+ årige",
      noegletal: "Ventetid på plejebolig",
    },
    {
      id: "hjemmehjaelp",
      label: "Hjemmehjælp",
      forklaring: "Visiterede timer hjemmehjælp pr. uge pr. modtager på 67 år og derover",
      noegletal: "Hjemmehjælp pr. modtager",
    },
  ],
};
