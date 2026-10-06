// Udjævning af små kommuners tal pr. indbygger, før de får en score.
//
// Et nøgletal som indbrud pr. 1.000 indbyggere bygger på få hændelser i en lille kommune,
// så tilfældigheder slår hårdt igennem: ét indbrud mere eller mindre på Læsø flytter den fra
// top til bund. Derfor trækkes tallet mod landsniveauet, jo færre indbyggere kommunen har:
//
//   udjævnet = (indbyggere × kommunens tal + K × landsniveau) / (indbyggere + K)
//
// Med K = 5.000 beholder Læsø (ca. 1.800 indbyggere) godt en fjerdedel af sit eget tal, en
// kommune med 50.000 indbyggere ca. 90 %, og de store kommuner er praktisk talt uændrede.
// Landsniveauet er gennemsnittet vægtet med indbyggertal, dvs. tallet for hele landet.
// Kun scoren udjævnes; rapporterne viser de rigtige tal.

export const UDJAEVNING_INDBYGGERE = 5000;

// Nøgletallet med kommunernes indbyggertal (kategorien Indbyggertal).
export const BEFOLKNING_NOEGLETAL = "Indbyggere";

// Nøgletal, der er et antal hændelser eller personer pr. indbygger, og som derfor svinger
// tilfældigt i små kommuner. Priser, skatter, arealer og afstande er ikke med.
export const UDJAEVNEDE_NOEGLETAL = new Set([
  "Indbrud i beboelser pr. 1.000 indbyggere",
  "Vold og røveri pr. 1.000 indbyggere",
  "Anmeldte forbrydelser pr. 1.000 indbyggere",
  "Medlemskaber af idrætsforeninger",
  "Idrætsanlæg pr. 10.000 indbyggere",
  "Spisesteder pr. 1.000 indbyggere",
  "Job pr. 1.000 indbyggere",
  "Middellevetid",
]);

/** Udjævner ét nøgletals værdier (se øverst). Kommuner uden indbyggertal er uændrede. */
export function udjaevn(
  vaerdier: { kommuneKode: string; vaerdi: number }[],
  indbyggere: Map<string, number>,
) {
  let sum = 0;
  let antal = 0;
  for (const { kommuneKode, vaerdi } of vaerdier) {
    const n = indbyggere.get(kommuneKode);
    if (!n) continue;
    sum += vaerdi * n;
    antal += n;
  }
  if (antal === 0) return vaerdier;
  const landsniveau = sum / antal;
  return vaerdier.map(({ kommuneKode, vaerdi }) => {
    const n = indbyggere.get(kommuneKode);
    if (!n) return { kommuneKode, vaerdi };
    return {
      kommuneKode,
      vaerdi: (n * vaerdi + UDJAEVNING_INDBYGGERE * landsniveau) / (n + UDJAEVNING_INDBYGGERE),
    };
  });
}
