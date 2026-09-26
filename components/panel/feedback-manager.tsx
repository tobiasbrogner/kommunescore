"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, ToggleButton, ToggleButtonGroup } from "@heroui/react";

type FeedbackType = "fejl" | "oenske" | "mangel" | "andet";

type Feedback = {
  id: number;
  type: FeedbackType;
  besked: string;
  email: string | null;
  side: string | null;
  brugeragent: string | null;
  behandlet: boolean;
  createdAt: string;
};

const TYPE_INFO: Record<FeedbackType, { navn: string; farve: "danger" | "accent" | "warning" | "default" }> = {
  fejl: { navn: "Fejl", farve: "danger" },
  oenske: { navn: "Ønske", farve: "accent" },
  mangel: { navn: "Mangler data", farve: "warning" },
  andet: { navn: "Andet", farve: "default" },
};

type Filter = "ubehandlet" | "alle" | FeedbackType;

const datoFormat = new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" });

export function FeedbackManager({ feedback }: { feedback: Feedback[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ubehandlet");
  const [fejl, setFejl] = useState<string | null>(null);
  const [travl, setTravl] = useState<number | null>(null);

  const antalUbehandlet = feedback.filter((f) => !f.behandlet).length;
  const synlige = feedback.filter((f) =>
    filter === "alle" ? true : filter === "ubehandlet" ? !f.behandlet : f.type === filter,
  );

  async function kald(id: number, init: RequestInit) {
    setTravl(id);
    setFejl(null);
    const res = await fetch(`/api/admin/feedback/${id}`, init);
    setTravl(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setFejl(data?.fejl ?? "Handlingen mislykkedes.");
      return;
    }
    router.refresh();
  }

  function saetBehandlet(id: number, behandlet: boolean) {
    return kald(id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behandlet }),
    });
  }

  function slet(id: number) {
    if (!confirm("Slet denne feedback permanent?")) return;
    return kald(id, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Feedback</h2>
          <p className="text-sm text-muted">
            {antalUbehandlet} ubehandlet · {feedback.length} i alt
          </p>
        </div>

        <ToggleButtonGroup
          aria-label="Filtrér feedback"
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[filter]}
          onSelectionChange={(keys) => {
            const [valgt] = keys;
            if (valgt) setFilter(valgt as Filter);
          }}
        >
          <ToggleButton id="ubehandlet">Ubehandlet</ToggleButton>
          <ToggleButton id="alle">
            <ToggleButtonGroup.Separator />
            Alle
          </ToggleButton>
          {(Object.keys(TYPE_INFO) as FeedbackType[]).map((t) => (
            <ToggleButton key={t} id={t}>
              <ToggleButtonGroup.Separator />
              {TYPE_INFO[t].navn}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      {fejl && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{fejl}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {synlige.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          {filter === "ubehandlet" ? "Ingen ubehandlet feedback. 🎉" : "Ingen feedback her."}
        </p>
      ) : (
        synlige.map((f) => (
          <Card
            key={f.id}
            className={`border border-border/80 bg-background ${f.behandlet ? "opacity-60" : ""}`}
          >
            <Card.Header className="flex flex-row flex-wrap items-center gap-2">
              <Chip size="sm" color={TYPE_INFO[f.type].farve} variant="soft">
                {TYPE_INFO[f.type].navn}
              </Chip>
              {f.behandlet && (
                <Chip size="sm" color="success" variant="soft">
                  Behandlet
                </Chip>
              )}
              <span className="text-xs text-muted">{datoFormat.format(new Date(f.createdAt))}</span>
              {f.side && (
                <a
                  href={f.side}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono text-xs text-muted underline-offset-2 hover:underline"
                >
                  {f.side}
                </a>
              )}
            </Card.Header>

            <Card.Content className="flex flex-col gap-3">
              <p className="whitespace-pre-wrap text-sm leading-6">{f.besked}</p>
              {f.brugeragent && (
                <p className="truncate text-xs text-muted" title={f.brugeragent}>
                  {f.brugeragent}
                </p>
              )}
            </Card.Content>

            <Card.Footer className="flex flex-wrap items-center gap-2">
              {f.email && (
                <a
                  className="mr-auto text-sm text-accent underline-offset-2 hover:underline"
                  href={`mailto:${f.email}?subject=${encodeURIComponent("Ang. din feedback")}`}
                >
                  Svar {f.email}
                </a>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={travl === f.id}
                  onPress={() => saetBehandlet(f.id, !f.behandlet)}
                >
                  {f.behandlet ? "Markér som ubehandlet" : "Markér som behandlet"}
                </Button>
                <Button
                  size="sm"
                  variant="danger-soft"
                  isDisabled={travl === f.id}
                  onPress={() => slet(f.id)}
                >
                  Slet
                </Button>
              </div>
            </Card.Footer>
          </Card>
        ))
      )}
    </div>
  );
}
