// Tal på dansk. Store tal (fx indbyggere) uden decimaler, små tal (fx pr. 1.000) med
// højst maksDecimaler. Bruges både på rapportsiden og på kommunekortene på /kort.

const formatere = new Map<number, Intl.NumberFormat>();

function formater(decimaler: number) {
  let f = formatere.get(decimaler);
  if (!f) {
    f = new Intl.NumberFormat("da-DK", { maximumFractionDigits: decimaler });
    formatere.set(decimaler, f);
  }
  return f;
}

export function formaterTal(v: number, maksDecimaler = 2) {
  return formater(Math.abs(v) >= 100 ? 0 : maksDecimaler).format(v);
}
