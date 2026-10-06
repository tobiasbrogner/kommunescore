# Idéer til senere

Idéer, der er værd at lave, men som ikke er sat i gang endnu. Skriv gerne nye ind her.

## Lille Danmarkskort på kommunesiden

**Hvad:** Et lille kort over Danmark med en prik, der viser, hvor kommunen ligger. Det kan stå i boksen "Om [kommune]" på `/kommune/[navn]`.

**Hvorfor:** Mange ved ikke, hvor fx Lemvig, Faxe eller Struer ligger. I dag står kun regionen på siden.

**Sådan kan det laves:**
- Genbrug Danmarkskortet fra forsiden: kystlinjen (`DANMARK_STI`, `BORNHOLM_STI`) og `projekterTilDanmarkskort` i `lib/danmarkskort.ts`.
- Kommunens placering findes allerede i `data/kommune-punkter.json` (kommunens største by som punkt), som forsiden også bruger.
- Bornholm står i en ramme i hjørnet på forsidekortet; `projekterTilDanmarkskort` flytter selv punkter på Bornholm derop.
- Ingen nye data eller nye pakker.

## Del dit resultat fra kommunetesten

**Hvad:** En "Del"-knap ved resultatet på `/kommunetest`, der giver et link til den samme top 6.

**Hvorfor:** I dag forsvinder resultatet, når man lukker siden, og det kan ikke sendes til fx en partner eller familie, man skal flytte sammen med.

**Sådan kan det laves:**
- Gem svarene i linket, fx `/kommunetest?svar=...`, og vis resultatet direkte, når linket åbnes. Svarene er korte id'er (se `SPOERGSMAAL` i `lib/kommunetest.ts`), så linket bliver ikke langt.
- Resultatet beregnes allerede ud fra svarene (`byggPrioritet` og `findMatch` i `lib/kommunetest.ts`), så linket giver altid samme top 6, så længe tallene er de samme.
- Del-knappen kan virke som på kommunerapporten (`components/rapport-vaerktoejer.tsx`): telefonens del-menu, ellers kopiér link.
- Husk tests af, at svar → link → svar giver det samme (som `lib/scores/prioritet-link.test.ts`).
