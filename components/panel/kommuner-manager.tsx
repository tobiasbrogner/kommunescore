"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Description,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import { IconExternalLink } from "@tabler/icons-react";
import { kommuneSlug } from "@/lib/kommuner/slug";

type Kommune = {
  kode: string;
  navn: string;
  stoersteBy: string | null;
  beskrivelse: string | null;
};

const MAKS_BESKRIVELSE = 2000;

// Redigering af teksterne til "Om [kommune]" på rapportsiden.
export function KommunerManager({ kommuner }: { kommuner: Kommune[] }) {
  const router = useRouter();
  const [soegning, setSoegning] = useState("");
  const [valgtKode, setValgtKode] = useState(kommuner[0]?.kode ?? "");

  const synlige = useMemo(() => {
    const q = soegning.trim().toLowerCase();
    return q ? kommuner.filter((k) => k.navn.toLowerCase().includes(q)) : kommuner;
  }, [kommuner, soegning]);

  const antalUdenTekst = kommuner.filter((k) => !k.beskrivelse).length;
  const valgt = kommuner.find((k) => k.kode === valgtKode) ?? null;

  return (
    <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <TextField aria-label="Søg efter kommune" value={soegning} onChange={setSoegning}>
          <Input type="search" placeholder="Søg efter kommune" />
        </TextField>
        <p className="text-xs text-muted">
          {antalUdenTekst === 0
            ? "Alle kommuner har en beskrivelse."
            : `${antalUdenTekst} af ${kommuner.length} mangler beskrivelse.`}
        </p>
        <ul className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto rounded-xl border border-border p-1">
          {synlige.map((k) => (
            <li key={k.kode}>
              <button
                type="button"
                onClick={() => setValgtKode(k.kode)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  k.kode === valgtKode
                    ? "bg-accent/10 font-medium text-accent"
                    : "text-foreground hover:bg-surface-secondary"
                }`}
              >
                <span className="truncate">{k.navn}</span>
                {!k.beskrivelse && (
                  <span className="shrink-0 text-[10px] text-muted">Mangler tekst</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {valgt ? (
        // key nulstiller formularen, når man vælger en anden kommune.
        <KommuneFormular key={valgt.kode} kommune={valgt} onGemt={() => router.refresh()} />
      ) : (
        <p className="text-sm text-muted">Vælg en kommune.</p>
      )}
    </div>
  );
}

function KommuneFormular({ kommune, onGemt }: { kommune: Kommune; onGemt: () => void }) {
  const [stoersteBy, setStoersteBy] = useState(kommune.stoersteBy ?? "");
  const [beskrivelse, setBeskrivelse] = useState(kommune.beskrivelse ?? "");
  const [gemmer, setGemmer] = useState(false);
  const [besked, setBesked] = useState<{ type: "succes" | "fejl"; tekst: string } | null>(null);

  const aendret =
    stoersteBy !== (kommune.stoersteBy ?? "") || beskrivelse !== (kommune.beskrivelse ?? "");

  async function gem() {
    setGemmer(true);
    setBesked(null);
    try {
      const res = await fetch(`/api/admin/kommuner/${kommune.kode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stoersteBy, beskrivelse }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.fejl ?? "Der skete en fejl.");
      }
      setBesked({ type: "succes", tekst: "Gemt. Rapportsiden er opdateret." });
      onGemt();
    } catch (err) {
      setBesked({ type: "fejl", tekst: err instanceof Error ? err.message : "Der skete en fejl." });
    } finally {
      setGemmer(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{kommune.navn}</h2>
          <p className="text-xs text-muted">Kommunekode {kommune.kode}</p>
        </div>
        <a
          href={`/kommune/${kommuneSlug(kommune.navn)}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          Se rapporten
          <IconExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <TextField value={stoersteBy} onChange={setStoersteBy}>
        <Label>Største by</Label>
        <Input placeholder="fx Aarhus" maxLength={100} />
      </TextField>

      <div className="flex flex-col gap-2">
        <Label htmlFor="kommune-beskrivelse">Beskrivelse</Label>
        <TextArea
          id="kommune-beskrivelse"
          aria-describedby="kommune-beskrivelse-hjaelp"
          rows={8}
          maxLength={MAKS_BESKRIVELSE}
          value={beskrivelse}
          onChange={(e) => setBeskrivelse(e.target.value)}
          placeholder="5-8 linjer med faktuel beskrivelse af kommunen."
          style={{ resize: "vertical" }}
        />
        <Description id="kommune-beskrivelse-hjaelp">
          Vises under &quot;Om {kommune.navn}&quot; på rapportsiden. Tomme linjer bliver til nye
          afsnit. {beskrivelse.length} / {MAKS_BESKRIVELSE} tegn.
        </Description>
      </div>

      {besked && (
        <Alert status={besked.type === "succes" ? "success" : "danger"}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{besked.tekst}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button variant="primary" isDisabled={!aendret || gemmer} onPress={gem}>
          {gemmer ? "Gemmer …" : "Gem"}
        </Button>
      </div>
    </div>
  );
}
