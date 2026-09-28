"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "@heroui/react";
import { IconMessageChatbot, IconRefresh, IconSend, IconX } from "@tabler/icons-react";

// AI-chatten nederst til venstre på kortet. Samtalen findes kun i browseren og sendes
// med til serveren ved hver besked (se app/api/chat/route.ts).

type Besked = { rolle: "bruger" | "assistent"; tekst: string };

// Skal passe med grænserne i app/api/chat/route.ts.
const MAKS_BESKEDER = 16;
const MAKS_TEGN = 500;

const FORSLAG = [
  "Hvor er det billigst at bo med børn?",
  "Hvordan bruger jeg Prioritet?",
  "Fortæl mig om Aarhus",
];

// Botten skriver lidt markdown: **fed**, punktlister og links til sidens egne sider.
// Kun interne links (/…) bliver til links, og de åbner i en ny fane, så kortet bevares.
function formaterLinje(linje: string): ReactNode[] {
  const dele: ReactNode[] = [];
  const moenster = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*/g;
  let sidst = 0;
  for (const match of linje.matchAll(moenster)) {
    if (match.index > sidst) dele.push(linje.slice(sidst, match.index));
    if (match[1]) {
      dele.push(
        <a
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener"
          className="font-medium text-accent hover:underline"
        >
          {match[1]}
        </a>,
      );
    } else {
      dele.push(<strong key={match.index}>{match[3]}</strong>);
    }
    sidst = match.index + match[0].length;
  }
  if (sidst < linje.length) dele.push(linje.slice(sidst));
  return dele;
}

function BotTekst({ tekst }: { tekst: string }) {
  return (
    <>
      {tekst.split("\n").map((linje, i) => {
        const punkt = linje.match(/^\s*[-*•]\s+(.*)$/);
        if (punkt) {
          return (
            <p key={i} className="flex gap-1.5 pl-1">
              <span aria-hidden="true">•</span>
              <span>{formaterLinje(punkt[1])}</span>
            </p>
          );
        }
        return linje.trim() ? (
          <p key={i}>{formaterLinje(linje.replace(/^#+\s*/, ""))}</p>
        ) : (
          <div key={i} className="h-2" />
        );
      })}
    </>
  );
}

export function AiChat() {
  const [aaben, setAaben] = useState(false);
  const [beskeder, setBeskeder] = useState<Besked[]>([]);
  const [input, setInput] = useState("");
  const [venter, setVenter] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  // Beskeder tilbage i dag for denne IP; null indtil serveren har svaret.
  const [kvote, setKvote] = useState<{ tilbage: number; maks: number } | null>(null);
  const listeRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const afbrydRef = useRef<AbortController | null>(null);

  // Ny tekst ruller listen ned til bunden.
  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight });
  }, [beskeder, venter, fejl]);

  useEffect(() => {
    if (!aaben) return;
    inputRef.current?.focus();
    // Hentes hver gang chatten åbnes, så tallet også passer, hvis man har chattet i en anden fane.
    fetch("/api/chat")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (typeof data?.tilbage === "number") setKvote({ tilbage: data.tilbage, maks: data.maks });
      })
      .catch(() => {});
  }, [aaben]);

  const opdaterTilbage = (tilbage: unknown) => {
    const tal = Number(tilbage);
    if (tilbage != null && Number.isFinite(tal)) {
      setKvote((k) => (k ? { ...k, tilbage: tal } : k));
    }
  };

  // Stop et igangværende svar, hvis komponenten forsvinder.
  useEffect(() => () => afbrydRef.current?.abort(), []);

  // Der skal være plads til brugerens besked og bottens svar.
  const samtaleFuld = beskeder.length >= MAKS_BESKEDER - 1;
  const kvoteBrugt = kvote?.tilbage === 0;
  const kanSkrive = !samtaleFuld && !kvoteBrugt;

  const send = async (tekst: string) => {
    const besked = tekst.trim();
    if (!besked || venter || !kanSkrive) return;

    const historik: Besked[] = [...beskeder, { rolle: "bruger", tekst: besked }];
    setBeskeder(historik);
    setInput("");
    setFejl(null);
    setVenter(true);

    const afbryd = new AbortController();
    afbrydRef.current = afbryd;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beskeder: historik }),
        signal: afbryd.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        opdaterTilbage(data?.tilbage);
        // Beskeden fjernes igen, så samtalen stadig skifter mellem bruger og bot.
        setBeskeder(beskeder);
        setInput(besked);
        setFejl(data?.fejl ?? "Der skete en fejl. Prøv igen om lidt.");
        return;
      }

      opdaterTilbage(res.headers.get("X-Chat-Tilbage"));
      const laeser = res.body.getReader();
      const dekoder = new TextDecoder();
      let svar = "";
      for (;;) {
        const { done, value } = await laeser.read();
        if (done) break;
        svar += dekoder.decode(value, { stream: true });
        setBeskeder([...historik, { rolle: "assistent", tekst: svar }]);
      }
      if (!svar.trim()) {
        setBeskeder([...historik, { rolle: "assistent", tekst: "Jeg fik ikke noget svar. Prøv igen." }]);
      }
    } catch {
      if (afbryd.signal.aborted) return;
      setBeskeder(beskeder);
      setInput(besked);
      setFejl("Kunne ikke få forbindelse. Prøv igen.");
    } finally {
      if (afbrydRef.current === afbryd) afbrydRef.current = null;
      setVenter(false);
    }
  };

  const startForfra = () => {
    afbrydRef.current?.abort();
    setBeskeder([]);
    setFejl(null);
    setVenter(false);
    inputRef.current?.focus();
  };

  // Mens svaret streames, står bottens besked allerede i listen.
  const venterPaaFoersteTekst = venter && beskeder.at(-1)?.rolle === "bruger";

  return (
    <div className="absolute bottom-4 left-4 z-20 flex flex-col items-start gap-3">
      {aaben && (
        <section
          aria-label="Chat med hjælperen"
          className="flex h-[min(30rem,calc(100dvh-12rem))] w-[min(22rem,calc(100vw-4rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
        >
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <IconMessageChatbot className="h-5 w-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Spørg hjælperen</p>
              <p className="text-xs text-muted">AI · kan tage fejl</p>
            </div>
            {beskeder.length > 0 && (
              <button
                type="button"
                onClick={startForfra}
                aria-label="Start forfra"
                title="Start forfra"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground"
              >
                <IconRefresh className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setAaben(false)}
              aria-label="Luk chatten"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground"
            >
              <IconX className="h-4 w-4" />
            </button>
          </header>

          <div ref={listeRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3" aria-live="polite">
            <div className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-surface-secondary px-3 py-2 text-sm text-foreground">
              Hej! Fortæl mig, hvad der er vigtigt for dig, så finder jeg kommuner, der passer.
              Jeg kan også forklare, hvordan du bruger siden.
            </div>

            {beskeder.length === 0 && kanSkrive && (
              <div className="flex flex-col items-start gap-2">
                {FORSLAG.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => send(f)}
                    className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-foreground transition-colors duration-150 hover:border-accent hover:bg-accent/5"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            {beskeder.map((b, i) =>
              b.rolle === "bruger" ? (
                <div
                  key={i}
                  className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm whitespace-pre-wrap text-accent-foreground"
                >
                  {b.tekst}
                </div>
              ) : (
                <div
                  key={i}
                  className="flex max-w-[90%] flex-col gap-0.5 self-start rounded-2xl rounded-bl-md bg-surface-secondary px-3 py-2 text-sm leading-relaxed text-foreground"
                >
                  <BotTekst tekst={b.tekst} />
                </div>
              ),
            )}

            {venterPaaFoersteTekst && (
              <div className="flex items-center gap-2 self-start px-1 text-xs text-muted">
                <Spinner size="sm" /> Tænker…
              </div>
            )}

            {fejl && <p className="self-center text-center text-xs text-danger">{fejl}</p>}

            {samtaleFuld && !venter && (
              <p className="self-center text-center text-xs text-muted">
                Samtalen er blevet lang.{" "}
                <button type="button" onClick={startForfra} className="font-medium text-accent hover:underline">
                  Start forfra
                </button>{" "}
                for at stille flere spørgsmål.
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={MAKS_TEGN}
                disabled={!kanSkrive}
                placeholder={kvoteBrugt ? "Du har brugt dagens beskeder" : "Skriv dit spørgsmål…"}
                aria-label="Dit spørgsmål"
                className="max-h-24 min-h-10 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={venter || !kanSkrive || !input.trim()}
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-opacity duration-150 disabled:opacity-40"
              >
                <IconSend className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] leading-snug">
              <p className="text-muted">Skriv ikke personlige oplysninger.</p>
              {kvote && (
                <p
                  className={`shrink-0 font-medium tabular-nums ${
                    kvote.tilbage === 0
                      ? "text-danger"
                      : kvote.tilbage <= 2
                        ? "text-warning"
                        : "text-muted"
                  }`}
                  title="Antallet nulstilles et døgn efter dit første spørgsmål."
                >
                  {kvote.tilbage} af {kvote.maks} tilbage i dag
                </p>
              )}
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAaben((a) => !a)}
        aria-expanded={aaben}
        aria-label={aaben ? "Luk chatten" : "Spørg hjælperen"}
        className="flex h-12 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground shadow-lg transition-transform duration-150 hover:scale-105"
      >
        {aaben ? <IconX className="h-5 w-5" /> : <IconMessageChatbot className="h-5 w-5" />}
        {!aaben && <span>Spørg hjælperen</span>}
      </button>
    </div>
  );
}
