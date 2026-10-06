# Kommuna

Find den kommune, der passer til dit liv. Kommuna sammenligner alle 98 danske kommuner på 12 kategorier (boligpriser, skat, børn, tryghed, pendling m.fl.) ud fra offentlige tal, primært fra Danmarks Statistik. Brugeren vægter selv kategorierne og får sin egen rangering.

**Sider:** forside (`/`), kortet med Oversigt og Regneark (`/kort`), kommunerapporter (`/kommune/[navn]`), Sammenlign (`/sammenlign`), Sådan virker det, Kilder og admin-panelet (`/panel`).

**Teknik:** Next.js (App Router) og TypeScript, HeroUI og Tailwind, MapLibre til kortet, PostgreSQL med Drizzle ORM og Claude til "Spørg hjælperen". Pakkehåndtering med pnpm.

> Projektet bruger en nyere Next.js end den mest udbredte. Se `AGENTS.md` og dokumentationen i `node_modules/next/dist/docs/`.

## Kom i gang

1. Installér pakkerne:
   ```bash
   pnpm install
   ```
2. Opret `.env.local` ud fra skabelonen og udfyld værdierne (se tabellen nedenfor):
   ```bash
   cp .env.example .env.local
   ```
3. Start en database. Lokalt kan Docker bruges (samme login som i `.env.example`):
   ```bash
   docker compose up -d
   ```
4. Opret tabellerne:
   ```bash
   pnpm db:migrate
   ```
5. Fyld data i (se "Data" nedenfor), og start udviklingsserveren:
   ```bash
   pnpm dev
   ```
   Siden kører på http://localhost:3000.

## Miljøvariabler

| Variabel | Bruges til |
| --- | --- |
| `DATABASE_URL` | Forbindelsen til PostgreSQL |
| `DATABASE_CA_CERT` | Kun ved hostet database (Aiven): CA-certifikatet |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Opretter administratoren med `pnpm db:seed:admin` |
| `REVALIDATE_SECRET` | Lader seed-scripts rydde sidens cache, så nye tal vises med det samme |
| `GSEARCH_TOKEN` | Adressesøgningen under Pendling (Dataforsyningen). Mangler den, bruges Photon |
| `ANTHROPIC_API_KEY` | "Spørg hjælperen" på kortet |
| `APP_URL` | Sidens adresse. Lokalt `http://localhost:3000`; ved lancering det rigtige domæne (bruges i sitemap, delinger og PDF) |
| `TRUSTED_PROXY_HOPS` | Valgfri (standard 1). Antal proxyer foran siden, så den besøgendes rigtige IP findes til grænserne for login, chat og feedback |
| `DATABASE_POOL_MAX` | Valgfri (standard 5). Højst så mange databaseforbindelser pr. serverproces |

`.env.local` må aldrig committes. Kun `.env.example` ligger i git.

## Data

Tallene hentes ind med seed-scripts. De fleste henter direkte fra Statistikbankens API.

```bash
pnpm db:seed:kommuner        # kommunerne (først)
pnpm db:seed:admin           # administrator til /panel
pnpm db:seed:boligpriser     # og de øvrige kategorier:
pnpm db:seed:indbyggertal    # befolkningstaethed, kommuneskat, spisesteder, natur,
pnpm db:seed:boern           # idraet, jobmuligheder, tryghed, sundhed, aeldre, pendling
pnpm db:seed:kommune-tekster # beskrivelser til kommunerapporterne
pnpm db:sorter               # kategoriernes rækkefølge (kør efter seed-scripts)
```

- **Rækkefølgen af kategorierne** står ét sted: listen i `scripts/sorter-kategorier.ts`. Nye kategorier skal tilføjes der.
- **Nye kategorier** kræver også en linje i `KORT_NOEGLETAL` (og evt. `NOEGLETAL_VALG`) i `components/danmark-kort.tsx`, vægte i `lib/scores/profiler.ts` og en tekst i `KATEGORI_TEKST` på forsiden (`app/page.tsx`).
- `pnpm db:studio` åbner databasen i browseren.

## Kort og billeder

| Kommando | Laver |
| --- | --- |
| `pnpm kort:graenser` | Den lette udgave af kommunegrænserne til kortet (`public/data/kommuner-kort.geojson`), navnenes placering og forhåndsvisningen, der vises, mens kortet indlæses |
| `pnpm kort:forside` | Danmarkskortet på forsiden (`lib/danmarkskort.ts`) |
| `pnpm billeder:hent` | Kommunefotos fra Wikimedia Commons (`public/kommuner/`) |
| `pnpm punkter:hent` | Kommunernes største by som punkt (`data/kommune-punkter.json`) |

Fotos og illustrationer er krediteret på `/kilder`.

## Udvikling

```bash
pnpm dev     # udviklingsserver
pnpm lint    # ESLint
pnpm build   # produktionsbuild
npx tsc --noEmit -p .   # typetjek
```

## Lancering (tjekliste)

- Domæne og hosting; sæt alle miljøvariabler hos hostingen, især `APP_URL`.
- Ny adgangskode til databasen (Aiven) og begrænsning af tilladte IP-adresser.
- Evt. ny `GSEARCH_TOKEN`.
- Indsend `sitemap.xml` i Google Search Console.
- Privatlivspolitik og cookiebanner (kræves bl.a. af Google AdSense).
- Nyhedsbrev med rigtigt mailsystem, samtykke og afmelding.
