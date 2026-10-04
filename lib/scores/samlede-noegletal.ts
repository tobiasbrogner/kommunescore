// Nøgletal, der er et samlet gennemsnit af kategoriens øvrige nøgletal. De fremhæves i
// kategoriens info-boks på /kort og i admin-panelets værditabel. Listen er eksplicit, så
// et nyt nøgletal med fx "gennemsnit" i navnet ikke ved et uheld bliver behandlet sådan.
export const BOERNEPASNING_SAMLET = "Gennemsnitspris årligt";

const SAMLEDE_NOEGLETAL = new Set([BOERNEPASNING_SAMLET]);

export function erSamletNoegletal(navn: string) {
  return SAMLEDE_NOEGLETAL.has(navn);
}
