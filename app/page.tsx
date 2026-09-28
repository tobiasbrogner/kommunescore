import { Button, Card, Input } from "@heroui/react";

export default function Home() {
  return (
    <main className="overflow-hidden">
      {/* HERO */}
      <section id="start" className="relative">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <div className="motion-rise">
              <p className="mb-5 text-sm font-medium tracking-wide text-accent">
                Danmark gjort mere overskueligt
              </p>

              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-foreground sm:text-6xl lg:text-7xl">
                Find et sted,
                <br />
                der passer til
                <br />
                <span className="text-accent">dit liv.</span>
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-8 text-muted sm:text-xl">
                TestProjekt hjælper dig med at udforske danske byer og
                områder, så du kan finde et sted, der føles rigtigt for dig.
              </p>

              <div className="mt-9">
                <div className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm sm:flex-row">
                  <Input
                    aria-label="Søg efter by eller område"
                    placeholder="Søg fx Aarhus, Silkeborg eller Nordsjælland"
                    className="min-w-0 flex-1"
                    size="lg"
                  />

                  <Button
                    variant="primary"
                    size="lg"
                    className="shrink-0"
                  >
                    Find område
                  </Button>
                </div>

                <p className="mt-3 text-sm text-muted">
                  Start med en by, et område eller noget helt andet.
                </p>
              </div>
            </div>

            <div className="motion-rise motion-delay-1">
              <Card
                variant="secondary"
                className="relative overflow-hidden rounded-[2rem] border border-border/80 shadow-sm"
              >
                <Card.Content className="min-h-[430px] p-0">
                  <div className="absolute inset-0 bg-surface-secondary" />

                  <div className="relative flex h-full min-h-[430px] flex-col justify-between p-7 sm:p-9">
                    <div>
                      <p className="text-sm font-medium text-muted">
                        Et andet perspektiv på Danmark
                      </p>

                      <h2 className="mt-4 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
                        Ikke bare hvor du bor.
                        <br />
                        Men hvordan du vil bo.
                      </h2>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Card className="border border-border/80 bg-background/85 transition-transform duration-300 hover:-translate-y-1">
                        <Card.Content className="p-5">
                          <p className="text-sm text-muted">
                            Udforsk
                          </p>
                          <p className="mt-2 text-lg font-medium">
                            Byer & områder
                          </p>
                        </Card.Content>
                      </Card>

                      <Card className="border border-border/80 bg-background/85 transition-transform duration-300 hover:-translate-y-1">
                        <Card.Content className="p-5">
                          <p className="text-sm text-muted">
                            Sammenlign
                          </p>
                          <p className="mt-2 text-lg font-medium">
                            Det, der betyder noget
                          </p>
                        </Card.Content>
                      </Card>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section
        id="udforsk"
        className="border-y border-border/70 bg-surface-secondary"
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-accent">
              Udforsk Danmark
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
              Gør beslutningen lettere.
            </h2>

            <p className="mt-5 text-lg leading-8 text-muted">
              Når man overvejer en ny by eller et nyt område, handler det om
              mere end én enkelt faktor. TestProjekt samler oplevelsen,
              så du kan se det større billede.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <Card className="h-full border border-border/80 bg-background transition-transform duration-300 hover:-translate-y-1">
              <Card.Header>
                <Card.Title>Find steder</Card.Title>
                <Card.Description>
                  Start med den by eller det område, du allerede kender.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <p className="text-sm leading-6 text-muted">
                  Bevæg dig fra det konkrete til det område, der måske passer
                  endnu bedre til dine behov.
                </p>
              </Card.Content>
            </Card>

            <Card className="h-full border border-border/80 bg-background transition-transform duration-300 hover:-translate-y-1">
              <Card.Header>
                <Card.Title>Sammenlign</Card.Title>
                <Card.Description>
                  Se forskellene mellem stederne, før du beslutter dig.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <p className="text-sm leading-6 text-muted">
                  Få et mere nuanceret billede af de steder, du overvejer.
                </p>
              </Card.Content>
            </Card>

            <Card className="h-full border border-border/80 bg-background transition-transform duration-300 hover:-translate-y-1">
              <Card.Header>
                <Card.Title>Opdag nyt</Card.Title>
                <Card.Description>
                  Måske er dit næste sted et sted, du ikke havde tænkt på.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <p className="text-sm leading-6 text-muted">
                  Udforsk Danmark på en måde, der gør det nemmere at se
                  alternativerne.
                </p>
              </Card.Content>
            </Card>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="saadan-virker-det">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-sm font-medium tracking-wide text-accent">
                Sådan virker det
              </p>

              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                Fra nysgerrig
                <br />
                til sikker på stedet.
              </h2>
            </div>

            <div className="space-y-4">
              <Card className="border border-border/80 bg-background transition-transform duration-300 hover:-translate-y-1">
                <Card.Content className="flex gap-5 p-6 sm:p-7">
                  <div className="shrink-0 text-sm font-medium text-accent">
                    01
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold">
                      Fortæl os, hvad du leder efter
                    </h3>
                    <p className="mt-2 leading-7 text-muted">
                      Start med en by eller et område, og begynd din
                      udforskning.
                    </p>
                  </div>
                </Card.Content>
              </Card>

              <Card className="border border-border/80 bg-background transition-transform duration-300 hover:-translate-y-1">
                <Card.Content className="flex gap-5 p-6 sm:p-7">
                  <div className="shrink-0 text-sm font-medium text-accent">
                    02
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold">
                      Sammenlign mulighederne
                    </h3>
                    <p className="mt-2 leading-7 text-muted">
                      Se hvilke steder der ligger tæt på det, du forestiller
                      dig.
                    </p>
                  </div>
                </Card.Content>
              </Card>

              <Card className="border border-border/80 bg-background transition-transform duration-300 hover:-translate-y-1">
                <Card.Content className="flex gap-5 p-6 sm:p-7">
                  <div className="shrink-0 text-sm font-medium text-accent">
                    03
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold">
                      Find dit næste sted
                    </h3>
                    <p className="mt-2 leading-7 text-muted">
                      Gå videre med de områder, der føles relevante for dig.
                    </p>
                  </div>
                </Card.Content>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="om" className="pb-20 sm:pb-24 lg:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card
            variant="secondary"
            className="overflow-hidden rounded-[2rem] border border-border"
          >
            <Card.Content className="p-8 sm:p-12 lg:p-16">
              <div className="max-w-2xl">
                <p className="text-sm font-medium tracking-wide text-accent">
                  TestProjekt
                </p>

                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                  Dit næste sted starter med et spørgsmål.
                </h2>

                <p className="mt-5 text-lg leading-8 text-muted">
                  Hvor kunne du egentlig trives?
                </p>

                <div className="mt-8">
                  <Button variant="primary" size="lg">
                    Udforsk Danmark
                  </Button>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>
      </section>
    </main>
  );
}