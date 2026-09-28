import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/dal";
import { chatKvoteBruger, chatKvoteGaest, erChatLoftNaaet } from "@/lib/auth/rate-limit";
import { byggSystemPrompt } from "@/lib/chat/system-prompt";
import { CHAT_VAERKTOEJER, koerVaerktoej } from "@/lib/chat/vaerktoejer";
import { getCachedKommuneScores } from "@/lib/scores/get-scores";

// AI-chatten på /kort. Klienten sender hele samtalen (kun tekst) hver gang, og svaret
// streames tilbage som ren tekst. Botten kan kun læse data via værktøjerne.

// Haiku er den billigste model og rigelig til at forklare siden og slå tal op.
const MODEL = "claude-haiku-4-5";
// Korte svar holder prisen nede; systemprompten beder også om korte svar.
const MAKS_TOKENS = 1024;
// Værktøjsrunder pr. besked, så en forvirret model ikke kan køre i ring på vores regning.
const MAKS_RUNDER = 4;
// Samtalen må højst have så mange beskeder (bruger + bot) og så lange brugerbeskeder.
const MAKS_BESKEDER = 16;
const MAKS_BRUGER_TEGN = 500;
const MAKS_BOT_TEGN = 4000;
// Haiku 4.5-priser i dollar pr. million tokens, kun til at anslå prisen i loggen.
// Cache-skrivning koster 1,25x input og cache-læsning 0,1x.
const PRIS_INPUT = 1;
const PRIS_OUTPUT = 5;

type IndBesked = { rolle: "bruger" | "assistent"; tekst: string };

function laesBeskeder(body: unknown): IndBesked[] | string {
  const beskeder = (body as { beskeder?: unknown } | null)?.beskeder;
  if (!Array.isArray(beskeder) || beskeder.length === 0) return "Samtalen er tom.";
  if (beskeder.length > MAKS_BESKEDER) {
    return "Samtalen er blevet lang. Start en ny samtale for at fortsætte.";
  }
  for (const [i, b] of beskeder.entries()) {
    const rolle = (b as IndBesked)?.rolle;
    const tekst = (b as IndBesked)?.tekst;
    if ((rolle !== "bruger" && rolle !== "assistent") || typeof tekst !== "string" || !tekst.trim()) {
      return "Ugyldig besked.";
    }
    // Beskederne skal skiftevis være brugerens og bottens og starte og slutte med brugeren.
    if (rolle !== (i % 2 === 0 ? "bruger" : "assistent")) return "Ugyldig samtale.";
    if (tekst.length > (rolle === "bruger" ? MAKS_BRUGER_TEGN : MAKS_BOT_TEGN)) {
      return `Beskeden må højst være ${MAKS_BRUGER_TEGN} tegn.`;
    }
  }
  if (beskeder.length % 2 === 0) return "Ugyldig samtale.";
  return beskeder as IndBesked[];
}

function ipFra(request: Request) {
  return request.headers.get("x-forwarded-for") ?? "ukendt";
}

// Indloggede tælles pr. konto med den store kvote, alle andre pr. IP med den lille.
async function kvoteFor(request: Request) {
  const bruger = await verifySession();
  return bruger
    ? { kvote: chatKvoteBruger, noegle: String(bruger.id) }
    : { kvote: chatKvoteGaest, noegle: ipFra(request) };
}

// Hvor mange beskeder brugeren har tilbage i dag. Bruger ikke af kvoten.
export async function GET(request: Request) {
  const { kvote, noegle } = await kvoteFor(request);
  return NextResponse.json(
    { tilbage: kvote.tilbage(noegle), maks: kvote.graense },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ fejl: "Chatten er ikke sat op endnu." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const beskeder = laesBeskeder(body);
  if (typeof beskeder === "string") {
    return NextResponse.json({ fejl: beskeder }, { status: 400 });
  }

  const { kvote, noegle } = await kvoteFor(request);
  if (!kvote.brug(noegle)) {
    return NextResponse.json(
      { fejl: "Du har brugt dagens beskeder til chatten. Prøv igen i morgen.", tilbage: 0 },
      { status: 429 },
    );
  }
  if (erChatLoftNaaet("alle")) {
    return NextResponse.json(
      { fejl: "Chatten har travlt i dag. Prøv igen i morgen." },
      { status: 429 },
    );
  }

  const { kategorier } = await getCachedKommuneScores();
  const system = byggSystemPrompt(kategorier);
  const messages: Anthropic.MessageParam[] = beskeder.map((b) => ({
    role: b.rolle === "bruger" ? "user" : "assistant",
    content: b.tekst,
  }));

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const skriv = (tekst: string) => controller.enqueue(encoder.encode(tekst));
      let harSkrevet = false;
      // Tokenforbrug for hele beskeden, summeret over alle værktøjsrunder.
      const forbrug = { runder: 0, input: 0, cacheSkriv: 0, cacheLaes: 0, output: 0 };

      try {
        for (let runde = 0; runde < MAKS_RUNDER; runde++) {
          const svar = client.messages.stream(
            {
              model: MODEL,
              max_tokens: MAKS_TOKENS,
              system,
              tools: CHAT_VAERKTOEJER,
              messages,
              // Cacher systemprompt, værktøjer og samtalen indtil nu, så næste kald er billigere.
              cache_control: { type: "ephemeral" },
            },
            // Lukker brugeren chatten, stoppes kaldet, så vi ikke betaler for et ulæst svar.
            { signal: request.signal },
          );

          // Tekst fra en ny runde får et linjeskift, så den ikke klistrer til den forrige.
          let foersteIRunden = true;
          svar.on("text", (delta) => {
            if (foersteIRunden && harSkrevet) skriv("\n\n");
            foersteIRunden = false;
            harSkrevet = true;
            skriv(delta);
          });

          const besked = await svar.finalMessage();
          forbrug.runder += 1;
          forbrug.input += besked.usage.input_tokens;
          forbrug.cacheSkriv += besked.usage.cache_creation_input_tokens ?? 0;
          forbrug.cacheLaes += besked.usage.cache_read_input_tokens ?? 0;
          forbrug.output += besked.usage.output_tokens;

          const vaerktoejskald = besked.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          if (besked.stop_reason !== "tool_use" || vaerktoejskald.length === 0) {
            if (besked.stop_reason === "refusal" && !harSkrevet) {
              skriv("Det kan jeg desværre ikke hjælpe med. Spørg gerne om kommunerne.");
            }
            controller.close();
            return;
          }

          messages.push({ role: "assistant", content: besked.content });
          const resultater: Anthropic.ToolResultBlockParam[] = await Promise.all(
            vaerktoejskald.map(async (kald) => {
              try {
                const resultat = await koerVaerktoej(kald.name, kald.input);
                return {
                  type: "tool_result" as const,
                  tool_use_id: kald.id,
                  content: JSON.stringify(resultat),
                };
              } catch (fejl) {
                console.error("Chat-værktøj fejlede", kald.name, fejl);
                return {
                  type: "tool_result" as const,
                  tool_use_id: kald.id,
                  content: "Opslaget fejlede.",
                  is_error: true,
                };
              }
            }),
          );
          messages.push({ role: "user", content: resultater });
        }

        skriv(
          `${harSkrevet ? "\n\n" : ""}Jeg nåede ikke helt i mål med det spørgsmål. Prøv at spørge lidt mere konkret.`,
        );
        controller.close();
      } catch (fejl) {
        if (request.signal.aborted) return;
        console.error("Chat fejlede", fejl);
        const tekst =
          fejl instanceof Anthropic.RateLimitError
            ? "Chatten har travlt lige nu. Prøv igen om lidt."
            : "Der skete en fejl. Prøv igen om lidt.";
        skriv(`${harSkrevet ? "\n\n" : ""}${tekst}`);
        controller.close();
      } finally {
        if (forbrug.runder > 0) {
          const dollar =
            (forbrug.input * PRIS_INPUT +
              forbrug.cacheSkriv * PRIS_INPUT * 1.25 +
              forbrug.cacheLaes * PRIS_INPUT * 0.1 +
              forbrug.output * PRIS_OUTPUT) /
            1_000_000;
          console.log(
            `Chat-forbrug: ${forbrug.runder} runde(r), ${beskeder.length} beskeder i samtalen, ` +
              `input ${forbrug.input}, cache skrevet ${forbrug.cacheSkriv}, cache læst ${forbrug.cacheLaes}, ` +
              `output ${forbrug.output}, ca. $${dollar.toFixed(5)}`,
          );
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Resterende beskeder i dag, så chatten kan vise det.
      "X-Chat-Tilbage": String(kvote.tilbage(noegle)),
    },
  });
}
