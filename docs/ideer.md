# Idéer til senere

Idéer, der er værd at lave, men som ikke er sat i gang endnu. Skriv gerne nye ind her.

## Del dit resultat fra kommunetesten

**Hvad:** En "Del"-knap ved resultatet på `/kommunetest`, der giver et link til den samme top 6.

**Hvorfor:** I dag forsvinder resultatet, når man lukker siden, og det kan ikke sendes til fx en partner eller familie, man skal flytte sammen med.

**Sådan kan det laves:**
- Gem svarene i linket, fx `/kommunetest?svar=...`, og vis resultatet direkte, når linket åbnes. Svarene er korte id'er (se `SPOERGSMAAL` i `lib/kommunetest.ts`), så linket bliver ikke langt.
- Resultatet beregnes allerede ud fra svarene (`byggPrioritet` og `findMatch` i `lib/kommunetest.ts`), så linket giver altid samme top 6, så længe tallene er de samme.
- Del-knappen kan virke som på kommunerapporten (`components/rapport-vaerktoejer.tsx`): telefonens del-menu, ellers kopiér link.
- Husk tests af, at svar → link → svar giver det samme (som `lib/scores/prioritet-link.test.ts`).
