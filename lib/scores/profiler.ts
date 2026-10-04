import {
  IconBabyCarriage,
  IconBuildingSkyscraper,
  IconCar,
  IconKey,
  IconOld,
  IconPigMoney,
  IconTrees,
  type Icon,
} from "@tabler/icons-react";
import { prioritetTilParametre } from "@/lib/scores/prioritet-link";

// Vægten, alle kategorier har fra start (samme som PRIORITET_STANDARD på kortet).
const STANDARDVAEGT = 50;

// Færdige profiler, der sætter Prioritet med ét klik (efter kategoriens slug). Kategorier,
// der ikke står i vaegte, får standardvægten; noegletal vælger id'er fra NOEGLETAL_VALG
// (mangler den for en kategori, gælder valget fra start). Alle kategorier er slået til.
export type Profil = {
  id: string;
  navn: string;
  beskrivelse: string;
  ikon: Icon;
  vaegte: Record<string, number>;
  noegletal?: Record<string, string[]>;
};
export const PROFILER: Profil[] = [
  {
    id: "boernefamilie",
    navn: "Børnefamilie",
    beskrivelse: "Billig børnepasning, tryghed og hus",
    ikon: IconBabyCarriage,
    vaegte: {
      boern: 100,
      tryghed: 80,
      boligpriser: 70,
      jobmuligheder: 60,
      kommuneskat: 50,
      indbyggertal: 20,
      spisesteder: 20,
      idraet: 70,
      aeldre: 30,
      natur: 60,
      sundhed: 60,
      pendling: 50,
    },
    noegletal: { boligpriser: ["hus"] },
  },
  {
    id: "pensionist",
    navn: "Pensionist",
    beskrivelse: "Ældrepleje, tryghed og sundhed. Job og børn tæller ikke",
    ikon: IconOld,
    vaegte: {
      tryghed: 100,
      sundhed: 100,
      kommuneskat: 80,
      natur: 70,
      spisesteder: 60,
      boligpriser: 50,
      indbyggertal: 40,
      idraet: 40,
      aeldre: 100,
      jobmuligheder: 0,
      boern: 0,
      pendling: 0,
    },
  },
  {
    id: "pendler",
    navn: "Pendler",
    beskrivelse: "Kort vej til arbejde og mange job",
    ikon: IconCar,
    vaegte: {
      pendling: 100,
      jobmuligheder: 90,
      indbyggertal: 70,
      boligpriser: 60,
      kommuneskat: 50,
      spisesteder: 40,
      tryghed: 40,
      sundhed: 40,
      boern: 30,
      natur: 30,
      idraet: 30,
      aeldre: 10,
    },
  },
  {
    id: "foerstegangskoeber",
    navn: "Førstegangskøber",
    beskrivelse: "Lave boligpriser, job og byliv",
    ikon: IconKey,
    vaegte: {
      boligpriser: 100,
      jobmuligheder: 80,
      pendling: 70,
      spisesteder: 60,
      indbyggertal: 60,
      kommuneskat: 50,
      tryghed: 40,
      idraet: 40,
      aeldre: 10,
      natur: 30,
      sundhed: 30,
      boern: 20,
    },
  },
  {
    id: "storbyliv",
    navn: "Storbyliv",
    beskrivelse: "Spisesteder, job og mange mennesker",
    ikon: IconBuildingSkyscraper,
    vaegte: {
      spisesteder: 100,
      indbyggertal: 90,
      jobmuligheder: 80,
      pendling: 60,
      tryghed: 40,
      kommuneskat: 40,
      sundhed: 40,
      boligpriser: 30,
      idraet: 20,
      aeldre: 10,
      natur: 10,
      boern: 0,
    },
    // Tætheden skelner byer fra store landkommuner med mange indbyggere.
    noegletal: { indbyggertal: ["antal", "taethed"] },
  },
  {
    id: "landliv",
    navn: "Landliv og ro",
    beskrivelse: "Natur, billige huse og tryghed",
    ikon: IconTrees,
    vaegte: {
      natur: 100,
      boligpriser: 90,
      tryghed: 90,
      kommuneskat: 70,
      boern: 50,
      idraet: 50,
      aeldre: 40,
      sundhed: 40,
      jobmuligheder: 30,
      spisesteder: 10,
      indbyggertal: 0,
      pendling: 0,
    },
    // Natur pr. indbygger trækker de tyndt befolkede kommuner frem.
    noegletal: { boligpriser: ["hus"], natur: ["andel", "pr-indbygger"] },
  },
  {
    id: "laveste-udgifter",
    navn: "Laveste udgifter",
    beskrivelse: "Billig bolig, lav skat og børnepasning",
    ikon: IconPigMoney,
    vaegte: {
      boligpriser: 100,
      kommuneskat: 100,
      boern: 60,
      pendling: 40,
      jobmuligheder: 30,
      tryghed: 30,
      natur: 20,
      sundhed: 20,
      idraet: 20,
      aeldre: 0,
      spisesteder: 0,
      indbyggertal: 0,
    },
  },
];

/** Link til kortet med profilens vægte og nøgletal, fx til profil-knapperne på forsiden.
 * Samme format som "Del" i Prioritet, så kortet læser det på samme måde. */
export function profilLink(profil: Profil) {
  const params = prioritetTilParametre({
    vaegte: Object.fromEntries(
      Object.entries(profil.vaegte).filter(([, vaegt]) => vaegt !== STANDARDVAEGT),
    ),
    fra: [],
    noegletal: profil.noegletal ?? {},
  });
  return params.size > 0 ? `/kort?${params}` : "/kort";
}
