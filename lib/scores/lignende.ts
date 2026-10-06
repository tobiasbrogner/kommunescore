import type { KategoriMeta, KommuneScore } from "@/lib/scores/compute";

// "Kommuner, der ligner": dem, hvis scorer ligger tættest på i alle kategorier, og som
// har en lignende størrelse. Afstanden er gennemsnittet af de kvadrerede forskelle (så
// manglende tal ikke trækker op eller ned), og roden af det.
//
// Indbyggertal er ikke en kategori her (den har vægt 0 i standardscoren); i stedet
// tæller antal indbyggere og befolkningstæthed hver med STOERRELSE_VAEGT. Uden størrelse
// lignede fx Aarhus mest Høje-Taastrup; med den er det Odense, Roskilde og København.
export const STOERRELSE_VAEGT = 2;
const STOERRELSE_NOEGLETAL = ["Indbyggere", "Indbyggere pr. km²"];
const UDEN_KATEGORI = "indbyggertal";

export function lignendeKommuner(
  kode: string,
  kommuner: KommuneScore[],
  kategorier: KategoriMeta[],
  antal = 4,
): KommuneScore[] {
  const kommune = kommuner.find((k) => k.kode === kode);
  if (!kommune) return [];

  const kategoriIder = kategorier.filter((k) => k.slug !== UDEN_KATEGORI).map((k) => k.id);
  const stoerrelseIder = kategorier
    .flatMap((k) => k.noegletal)
    .filter((n) => STOERRELSE_NOEGLETAL.includes(n.navn))
    .map((n) => n.id);

  const afstand = (anden: KommuneScore) => {
    let sum = 0;
    let vaegt = 0;
    const laeg = (a: number | undefined, b: number | undefined, v: number) => {
      if (a === undefined || b === undefined) return;
      sum += v * (a - b) ** 2;
      vaegt += v;
    };
    for (const id of kategoriIder) laeg(kommune.kategorier[id], anden.kategorier[id], 1);
    for (const id of stoerrelseIder) laeg(kommune.noegletal[id], anden.noegletal[id], STOERRELSE_VAEGT);
    return vaegt > 0 ? Math.sqrt(sum / vaegt) : Infinity;
  };

  return kommuner
    .filter((k) => k.kode !== kode)
    .map((k) => ({ k, afstand: afstand(k) }))
    .filter(({ afstand }) => Number.isFinite(afstand))
    .sort((a, b) => a.afstand - b.afstand || a.k.navn.localeCompare(b.k.navn, "da"))
    .slice(0, antal)
    .map(({ k }) => k);
}
