// Kommunens navn som URL-venlig adresse, fx "Høje-Taastrup" → "hoeje-taastrup".
// Æ, ø og å skrives som ae, oe og aa, så adressen er sikker at dele og skrive.
export function kommuneSlug(navn: string) {
  return navn
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
