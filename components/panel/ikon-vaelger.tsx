"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Label, Modal, TextField, useOverlayState } from "@heroui/react";
import { hentIkoner, humaniser, Ikon, type IkonKort, PladsholderIkon } from "@/components/ikon";

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
