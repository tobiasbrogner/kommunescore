import type { Metadata } from "next";
import NextLink from "next/link";
import { IconArrowLeft, IconHeart } from "@tabler/icons-react";
import { getCachedRapportData } from "@/lib/scores/get-scores";

export const metadata: Metadata = {
  title: "Sådan virker det | Kommuna",
  description:
    "Hvordan Kommuna regner kommunernes score ud, hvad farverne på kortet betyder, og hvad tallene ikke kan fortælle.",
};

function Afsnit({ id, titel, children }: { id: string; titel: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-xl font-semibold text-foreground">{titel}</h2>
      <div className="mt-3 flex max-w-2xl flex-col gap-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <NextLink href={href} className="font-medium text-accent hover:underline">
      {children}
    </NextLink>
  );
}

// Navne i en dansk opremsning: "A", "A og B", "A, B og C".
function opremsning(navne: string[]) {
  return navne.length <= 1 ? (navne[0] ?? "") : `${navne.slice(0, -1).join(", ")} og ${navne.at(-1)}`;
}

// Hvordan scorerne regnes ud, og hvordan de skal læses. Hvor tallene kommer fra, står for
// sig på /kilder. Spændet og standardvægtene hentes fra databasen, så teksten passer, når
// data eller vægte ændres. Afsnittet #beregning linkes til fra infoboksen på /kort.
export default async function SaadanVirkerDetSide() {
  const { kategorier, kommuner } = await getCachedRapportData();

  const samlet = kommuner.map((k) => k.samlet);
  const laveste = Math.round(Math.min(...samlet));
  const hoejeste = Math.round(Math.max(...samlet));

  const fuldVaegt = kategorier.filter((k) => k.standardvaegt >= 1);
  const delvisVaegt = kategorier.filter((k) => k.standardvaegt > 0 && k.standardvaegt < 1);
  const udenVaegt = kategorier.filter((k) => k.standardvaegt <= 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <NextLink
        href="/kort"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Til kortet
      </NextLink>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Sådan virker det
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Kommuna hjælper dig med at finde kommuner, der passer til det, du går op i. Her kan du
          læse, hvordan scoren bliver regnet ud, hvordan du skal læse den, og hvad den ikke kan
          fortælle dig.
        </p>
      </header>

      <aside className="mt-8 flex max-w-2xl gap-4 rounded-2xl border border-accent/20 bg-accent/5 p-5">
        <IconHeart className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-foreground">
          <p className="font-semibold">Der findes ingen dårlige kommuner</p>
          <p className="text-muted">
            I alle 98 kommuner lever folk gode liv. En lav score betyder ikke, at en kommune er
            et dårligt sted at bo. Den betyder kun, at kommunen ligger lavere end de andre på
            netop de tal, vi har valgt, med netop de vægte, der er sat. Vælger du andre vægte,
            kan billedet se helt anderledes ud.
          </p>
        </div>
      </aside>

      <Afsnit id="beregning" titel="Sådan regnes scoren ud">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            <strong className="font-medium text-foreground">Tallene er offentlige.</strong> De kommer
            fra offentlige statistikker, mest fra Danmarks Statistik. Under{" "}
            <Link href="/kilder">Kilder</Link> kan du se hvert tal, og hvor det kommer fra.
          </li>
          <li>
            <strong className="font-medium text-foreground">Små kommuner udjævnes.</strong> Tal
            pr. indbygger, fx indbrud, svinger meget i en lille kommune, hvor få hændelser kan
            flytte den fra top til bund. Derfor trækkes de mod landsniveauet, jo færre
            indbyggere kommunen har.{" "}
            <Link href="/kilder#smaa-kommuner">Læs mere om udjævningen</Link>. Rapporterne viser
            altid de rigtige tal.
          </li>
          <li>
            <strong className="font-medium text-foreground">
              Hvert tal bliver til en score fra 50 til 100.
            </strong>{" "}
            Kommunerne sammenlignes med hinanden. De 5 % med det bedste tal får 100, de 5 % med
            det laveste får 50, og resten fordeles jævnt imellem. Så kan få ekstreme kommuner,
            fx boligpriserne i hovedstadsområdet, ikke presse alle andre sammen. For fx priser,
            skat og ventetid er det laveste tal det bedste.
          </li>
          <li>
            <strong className="font-medium text-foreground">
              Nogle tal sammenlignes som forhold.
            </strong>{" "}
            For fx antal job inden for pendlingsafstand tæller en fordobling lige meget, uanset
            om man går fra 10.000 til 20.000 eller fra 200.000 til 400.000. Ellers ville kun de
            største byer kunne få en god score.
          </li>
          <li>
            <strong className="font-medium text-foreground">
              En kategori er gennemsnittet af sine tal.
            </strong>{" "}
            Mangler en kommune et tal, fordi det ikke er opgjort, tæller de andre tal i
            kategorien.
          </li>
          <li>
            <strong className="font-medium text-foreground">
              Den samlede score er et vægtet gennemsnit af kategorierne.
            </strong>{" "}
            Under Prioritet på kortet bestemmer du selv, hvor meget hver kategori vægter, eller
            du kan vælge en færdig profil.
          </li>
        </ol>
      </Afsnit>

      <Afsnit id="standardvaegte" titel="Standardvægtene">
        <p>
          Før du selv ændrer noget, tæller {opremsning(fuldVaegt.map((k) => k.navn))} lige meget.
          {delvisVaegt.length > 0 && (
            <>
              {" "}
              {opremsning(delvisVaegt.map((k) => k.navn))} tæller halvt, fordi job ikke betyder lige
              meget for alle, fx pensionister.
            </>
          )}
          {udenVaegt.length > 0 && (
            <>
              {" "}
              {opremsning(udenVaegt.map((k) => k.navn))} tæller slet ikke, fordi det er en
              smagssag, om man helst vil bo stort eller småt.
            </>
          )}
        </p>
        <p>
          Standardvægtene er et udgangspunkt, ikke et svar. Det er dig, der ved, hvad der betyder
          noget for dig.
        </p>
      </Afsnit>

      <Afsnit id="laes-scoren" titel="Sådan skal du læse scoren">
        <p>
          Scoren siger, hvordan en kommune ligger i forhold til de andre kommuner. Den siger ikke,
          om noget er godt eller skidt i sig selv. 50 betyder, at kommunen er blandt dem med de
          laveste tal i landet, men det laveste tal kan stadig være helt fint. Når næsten alle
          har gode forhold, er der stadig nogen, der ligger i bunden.
        </p>
        <p>
          Med standardvægtene ligger alle kommuner lige nu mellem {laveste} og {hoejeste}. Der er
          altså ikke så langt fra top til bund, som farverne på kortet kan give indtryk af.
        </p>
        <p>
          I hver kommunes rapport viser vi styrker og fokusområder. Et fokusområde er en kategori,
          hvor kommunen ligger lavere end i sine andre kategorier eller under landsgennemsnittet.
          Det er ikke et problem, men noget, du måske vil se nærmere på.
        </p>
      </Afsnit>

      <Afsnit id="farver" titel="Farverne på kortet">
        <p>
          Rød kan godt virke skræmmende, men på kortet betyder rød kun &quot;lavest af de viste
          kommuner&quot; og grøn &quot;højest&quot;. Fordi scorerne ligger tæt, strækkes farverne
          over kommunernes faktiske spænd, så forskellene kan ses. Små forskelle kan derfor se
          store ud.
        </p>
        <p>
          Under tandhjulet på kortet kan du vælge en anden farvepalet uden rødt, og du kan farve
          efter placering i stedet for score.
        </p>
      </Afsnit>

      <Afsnit id="hvad-tallene-ikke-viser" titel="Hvad tallene ikke kan fortælle">
        <p>
          Tal kan ikke måle alt. Naboerne, fællesskabet i landsbyen, udsigten fra køkkenvinduet,
          afstanden til familien eller følelsen af at komme hjem står ikke i nogen statistik.
          Brug Kommuna til at få øje på kommuner, du ikke havde tænkt på, og besøg dem gerne,
          før du bestemmer dig.
        </p>
        <p>
          Tallene er også et gennemsnit for hele kommunen. To byer i samme kommune kan være meget
          forskellige.
        </p>
      </Afsnit>

      <Afsnit id="aendringer" titel="Scoren kan ændre sig">
        <p>
          Scoren er ikke endelig. Den ændrer sig, når der kommer nye tal, og når vi bliver
          klogere på, hvordan tallene bedst bruges. Vi har fx ændret, hvordan tryghed og
          jobmuligheder måles, og hvordan små kommuner behandles, fordi de første udgaver ikke
          gav et retvisende billede. Det kommer vi til at gøre igen.
        </p>
        <p>
          Ser du noget, der virker forkert eller urimeligt, vil vi meget gerne høre det. Brug
          Feedback-knappen øverst på siden.
        </p>
      </Afsnit>
    </main>
  );
}
