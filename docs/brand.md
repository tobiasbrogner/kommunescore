# Kommuna – brandguide

## Logo

Logoet er en skråtstillet kompasnål og ordmærket **Kommuna**. Nålen viser retning, men det er brugeren, der vælger, hvor de vil hen.

| Fil | Brug |
| --- | --- |
| `public/brand/kommuna-logo.svg` | Standard, på lys baggrund |
| `public/brand/kommuna-logo-moerk-baggrund.svg` | På mørk baggrund |
| `public/brand/kommuna-logo-hvid.svg` | Én farve, hvid (fx på billeder eller farvede flader) |
| `public/brand/kommuna-logo-sort.svg` | Én farve, sort (fx tryk i sort/hvid) |
| `public/brand/kommuna-logo-staaende.svg` | Stående opsætning, når der er lidt bredde |
| `public/brand/kommuna-mark*.svg` | Nålen alene, i samme fire farvevarianter |
| `public/brand/kommuna-ikon.svg`, `kommuna-ikon-512.png` | App-ikon og profilbillede |
| `app/icon.svg`, `app/apple-icon.png` | Favicon og iOS-ikon (bruges automatisk af Next.js) |
| `app/opengraph-image.png` | Billede ved deling af links |

På siden bruges komponenterne `Logo` og `LogoMark` fra `components/logo.tsx`. De har samme geometri som filerne.

### Konstruktion

- Nålen er to trekanter med et mellemrum, drejet 30°. Forholdet mellem bredde og længde er ca. 1:2,7.
- Den sydlige halvdel har 40 % dækkeevne (60 % i ikonet).
- Ikonet bruger en lidt kraftigere nål, så den står tydeligt ved 16 px.
- Ordmærket er Manrope Bold konverteret til vektorer med let strammet bogstavafstand.

Filerne og `components/logo.tsx` er beregnet ud fra de samme mål. Hvis noget skal ændres, så lav hele sættet om på én gang, så filerne og siden ikke kommer ud af trit.

### Luft og størrelse

- Hold fri luft omkring logoet svarende til mindst højden af "K".
- Mindste bredde for det liggende logo: 96 px på skærm. Under det bruges nålen eller ikonet alene.
- Favicon og ikoner bruger flisen; nålen alene bruges ikke under 16 px.

### Undgå

- At dreje, strække eller genfarve nålen.
- At sætte ordmærket i en anden skrift.
- Farveovergangen på mellemfarvede eller urolige baggrunde. Brug den hvide eller sorte version.

## Farver

| Navn | Lys tema | Mørkt tema | Brug |
| --- | --- | --- | --- |
| Logo-overgang | `#5B21E6` → `#C026D3` | `#8B5CF6` → `#E879F9` | Kun i logo og ikon |
| Accent | `oklch(0.45 0.19 295)` | `oklch(0.76 0.13 298)` | Knapper, links, markeringer |
| Tekst | `oklch(0.19 0.012 285)` | `oklch(0.94 0.006 95)` | Brødtekst og overskrifter |
| Footer | `oklch(0.2 0.015 285)` | `oklch(0.13 0.012 285)` | Det næsten sorte bånd |

Den livlige overgang er forbeholdt logoet. Resten af siden bruger den dybere accentfarve sparsomt på rolige, neutrale flader. Kortets farveskalaer er data og følger ikke brandfarverne.

Farverne er defineret som CSS-variabler i `app/globals.css`.
