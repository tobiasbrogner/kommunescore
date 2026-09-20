"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Label, Modal, TextField, useOverlayState } from "@heroui/react";

type IkonKort = Record<string, string>;

let ikonPromise: Promise<IkonKort> | null = null;
function hentIkoner() {
  ikonPromise ??= fetch("/tabler-ikoner.json").then((res) => res.json());
  return ikonPromise;
}

function humaniser(navn: string) {
  return navn.replace(/-/g, " ");
}

function Ikon({ markup, className }: { markup: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function PladsholderIkon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M4 15l4 -4a2 2 0 0 1 2.5 0l4.5 4" />
      <path d="M14 14l1 -1a2 2 0 0 1 2.5 0l2.5 2.5" />
    </svg>
  );
}

const MAKS_RESULTATER = 96;

export function IkonVaelger({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (navn: string) => void;
}) {
  const state = useOverlayState();
  const [ikoner, setIkoner] = useState<IkonKort | null>(null);
  const [soegning, setSoegning] = useState("");

  useEffect(() => {
    if ((state.isOpen || value) && !ikoner) {
      hentIkoner().then(setIkoner);
    }
  }, [state.isOpen, value, ikoner]);

  const alleNavne = useMemo(() => (ikoner ? Object.keys(ikoner) : []), [ikoner]);

  const filtreretAlle = useMemo(() => {
    const q = soegning.trim().toLowerCase();
    return q ? alleNavne.filter((n) => humaniser(n).includes(q)) : alleNavne;
  }, [alleNavne, soegning]);

  const filtreret = filtreretAlle.slice(0, MAKS_RESULTATER);
  const valgtMarkup = value && ikoner ? ikoner[value] : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Ikon</Label>
      <Button variant="outline" className="w-11 justify-center px-0" onPress={state.open}>
        {valgtMarkup ? (
          <Ikon markup={valgtMarkup} className="h-5 w-5" />
        ) : (
          <PladsholderIkon className="h-5 w-5 text-muted" />
        )}
      </Button>

      <Modal.Backdrop isOpen={state.isOpen} onOpenChange={state.setOpen}>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="h-full max-h-full">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Vælg ikon</Modal.Heading>
              <TextField className="mt-3" value={soegning} onChange={setSoegning}>
                <Label>Søg</Label>
                <Input autoFocus placeholder="fx baby, hus, bil …" />
              </TextField>
            </Modal.Header>
            <Modal.Body>
              {!ikoner ? (
                <p className="text-sm text-muted">Indlæser ikoner…</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {filtreret.map((navn) => (
                      <button
                        key={navn}
                        type="button"
                        title={humaniser(navn)}
                        onClick={() => {
                          onChange(navn);
                          state.close();
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors hover:border-accent hover:bg-accent/5 ${
                          navn === value ? "border-accent bg-accent/10" : "border-border"
                        }`}
                      >
                        <Ikon markup={ikoner[navn]} className="h-5 w-5" />
                        <span className="w-full truncate text-[10px] text-muted">
                          {humaniser(navn)}
                        </span>
                      </button>
                    ))}
                  </div>

                  {filtreretAlle.length === 0 && (
                    <p className="mt-4 text-sm text-muted">
                      Ingen ikoner matcher &quot;{soegning}&quot;.
                    </p>
                  )}
                  {filtreretAlle.length > filtreret.length && (
                    <p className="mt-4 text-xs text-muted">
                      Viser {filtreret.length} af {filtreretAlle.length} — indsnævr søgningen for
                      at se flere.
                    </p>
                  )}
                </>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
