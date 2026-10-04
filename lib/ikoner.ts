import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IkonKort } from "@/components/ikon";

// Tabler-ikonerne ligger samlet i public/tabler-ikoner.json (ca. 1,5 MB, alle ~5.000
// ikoner, så ikonvælgeren i admin-panelet kan vise dem). Offentlige sider bruger kun
// kategoriernes få ikoner; dem slår serveren op her, så browseren ikke skal hente hele
// filen, og ikonerne står i HTML'en fra start. Filen læses én gang pr. serverproces.
let alleIkoner: Promise<IkonKort> | null = null;

function hentAlle() {
  alleIkoner ??= readFile(path.join(process.cwd(), "public/tabler-ikoner.json"), "utf8").then(
    (tekst) => JSON.parse(tekst) as IkonKort,
  );
  return alleIkoner;
}

/** SVG-indholdet for de navngivne ikoner; ukendte navne udelades. */
export async function ikonerFor(navne: (string | null)[]): Promise<IkonKort> {
  const alle = await hentAlle();
  return Object.fromEntries(
    navne.flatMap((navn) => (navn && alle[navn] ? [[navn, alle[navn]]] : [])),
  );
}
