import type { Metadata } from "next";
import NextLink from "next/link";
import { Card } from "@heroui/react";
import { IconArrowLeft, IconBulb, IconHelpCircle, type Icon } from "@tabler/icons-react";
import { IllustrationIdeTilPlan } from "@/components/illustration-ide-til-plan";
import { DATA_OPDATERET } from "@/lib/om-kommuna";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";

export const metadata: Metadata = {
  title: "Idéen bag | Kommuna",
  description:
    "Hvorfor Kommuna findes: Når man ikke kan bo, hvor man plejer, skal man kunne se, hvad man får og giver afkald på i nabokommunerne.",
};

function Afsnit({
  id,
  titel,
  ikon: Ikon,
  children,
}: {
  id: string;
  titel: string;
  ikon: Icon;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
        <Ikon className="h-5 w-5 shrink-0 text-accent" />
        {titel}
      </h2>
      <div className="mt-3 flex max-w-2xl flex-col gap-3 text-sm leading-relaxed text-pretty text-muted">
        {children}
      </div>
    </section>
  );
}

// Idéen bag Kommuna, i samme opsætning som Sådan virker det. Forsiden viser, hvad
// værktøjet kan; her står, hvorfor det findes.
export default async function IdeenBagSide() {
  const { kategorier, kommuner } = await getCachedKommuneScores();

  // Antal nøgletalsværdier bag scorerne, rundet ned til hele hundreder, som på forsiden.
  const antalTal = new Intl.NumberFormat("da-DK").format(
    Math.floor(kommuner.reduce((sum, k) => sum + Object.keys(k.vaerdier).length, 0) / 100) * 100,
  );
  const [maaned, aar] = DATA_OPDATERET.split(" ");
  const fakta = [
    { tal: String(kommuner.length), tekst: "kommuner" },
    { tal: String(kategorier.length), tekst: "kategorier" },
    { tal: `${antalTal}+`, tekst: "offentlige tal" },
    { tal: maaned, tekst: `${aar} · seneste data`, href: "/kilder" },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <NextLink
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Til forsiden
      </NextLink>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Idéen bag
        </h1>
        <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          {fakta.map(({ tal, tekst, href }) => (
            <div key={tekst} className="flex flex-col-reverse bg-surface px-4 py-3">
              <dt className="text-xs text-muted">
                {href ? (
                  <NextLink href={href} className="hover:text-accent hover:underline">
                    {tekst}
                  </NextLink>
                ) : (
                  tekst
                )}
              </dt>
              <dd className="text-2xl font-semibold tracking-tight tabular-nums text-foreground first-letter:uppercase">
                {tal}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <Afsnit id="spoergsmaalet" titel="Spørgsmålet" ikon={IconHelpCircle}>
        <p>
          I og omkring de store byer er boligpriserne steget så meget, at mange ikke længere har
          råd til at komme ind på boligmarkedet og bo der, hvor de er vokset op. Derfor&nbsp;kigger
          flere mod nabokommunerne.
        </p>
        <p>Men hvad får man egentlig dér – og hvad giver man afkald på?</p>
        <p>
          For når man flytter, handler det ikke kun om prisen på boligen. Det&nbsp;handler også om
          skatten, jobbene inden for rækkevidde, naturen, pasningen af børnene og tiden til og fra
          arbejde. Det&nbsp;er kompromiser, der bliver en del af
          hverdagen – og nogle af dem skal man kunne leve med i mange år frem.
        </p>
        <p>
          Så hvad er det egentlig, der gør nabokommunerne forskellige? Hvad&nbsp;får man for pengene,
          hvad skal man gå på kompromis med, og hvad kan i sidste ende være det, der afgør, hvor
          man vælger at slå sig ned?
        </p>
      </Afsnit>

      <Afsnit id="ideen" titel="Idéen" ikon={IconBulb}>
        <p>
          Hvordan laver man et brugervenligt, interaktivt, ærligt og transparent billede af,
          hvordan landets kommuner ser ud? Og&nbsp;hvordan sikrer vi, at den enkelte kan indstille
          præcis det, der er vigtigt for dem?
        </p>
        <p>
          Idéen bag Kommuna er at samle data og information om landets kommuner ét sted. Vi&nbsp;gør
          det nemt at se forskellene mellem kommunerne på udvalgte nøgletal og giver brugeren
          mulighed for selv at vægte det, der betyder mest.
        </p>
        <p>
          På den måde kan Kommuna være et værktøj til at blive klogere på mulighederne, når man
          overvejer at flytte, vil lære sin egen kommune at kende eller går med en boligdrøm.
        </p>
      </Afsnit>

      {/* Illustrationen og boksen står i samme kolonne som teksten (max-w-2xl). */}
      <div className="mt-12 max-w-2xl">
        <IllustrationIdeTilPlan className="mx-auto w-full max-w-lg" />
      </div>

      {/* Tobias' egen tekst om sig selv. */}
      {/* I en boks som afslutningen på forsiden. */}
      <section id="mig" className="mt-12 max-w-2xl scroll-mt-24">
        <Card variant="secondary" className="overflow-hidden rounded-[2rem] border border-border">
          <Card.Content className="p-6 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Mig</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-pretty text-muted">
              <p>
                Jeg hedder Tobias, og det her er et lille hobbyprojekt, jeg går og arbejder på. Mest&nbsp;fordi
                jeg altid har været nysgerrig og godt kan lide at lære nye ting – men også fordi
                jeg hurtigt kan blive ret opslugt, når jeg finder et formål med noget, der virkelig
                giver mening for mig.
              </p>
              <p>
                Det er vigtigt for mig at sige, at jeg har et fast arbejde, som jeg elsker, og som
                betyder rigtig meget for mig. Det&nbsp;her er derfor ikke et forsøg på at erstatte det, men
                snarere et sted, hvor jeg kan følge min nysgerrighed og fordybe mig i noget, jeg synes
                er spændende.
              </p>
              <p>
                Jeg er selv ny på boligmarkedet, og sammen med min kæreste har jeg også stået i
                situationer, hvor et værktøj som Kommuna kunne have været brugbart.
              </p>
              <p>
                Der er mange faktorer, der spiller ind, når man ønsker at købe sin egen bolig frem for at
                bo til leje. Vi&nbsp;valgte blandt andet at gå på kompromis med afstanden til arbejde og
                venner. Til&nbsp;gengæld fik vi en kommune med mere natur, gode muligheder for foreningsliv –
                og ikke mindst en helt anden boligpris.
              </p>
              <p>
                Hvor stort et behov har man egentlig for at kunne gå i byen?
                <br />
                Og hvor meget betyder ro og natur?
              </p>
              <p>
                Det var nogle af de spørgsmål, der fik mig til at tænke over, hvordan man egentlig
                vælger, hvor man skal bo. Der&nbsp;findes ikke ét rigtigt svar, da vores prioriteter,
                livssituationer og behov er forskellige. Og&nbsp;det var her, idéen til Kommuna opstod.
              </p>
            </div>
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
