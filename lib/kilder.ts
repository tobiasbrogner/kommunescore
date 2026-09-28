// Kilderne står i nøgletallenes beskrivelser, fx "(Danmarks Statistik, ERHV2 og FOLK1AM)".
// Ved at læse dem derfra kommer en ny kategori automatisk med på /kilder, så længe
// beskrivelsen følger samme mønster som seed-scripts'ene.

const DST_MOENSTER = /Danmarks Statistik, ([^)]+)\)/g;

/** Statistikbankens tabelkoder nævnt i en beskrivelse, fx ["ERHV2", "FOLK1AM"]. */
export function dstTabeller(beskrivelse: string | null): string[] {
  if (!beskrivelse) return [];
  const koder = [...beskrivelse.matchAll(DST_MOENSTER)].flatMap((m) =>
    m[1].split(/,| og /).map((k) => k.trim()),
  );
  return [...new Set(koder.filter((k) => /^[A-ZÆØÅ0-9]+$/.test(k)))];
}

export function statistikbankenUrl(tabel: string) {
  return `https://www.statistikbanken.dk/${tabel}`;
}
