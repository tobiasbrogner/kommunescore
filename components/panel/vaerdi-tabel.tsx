"use client";

import { useMemo, useState } from "react";
import { Button, Dropdown, Label } from "@heroui/react";

type Kommune = { kode: string; navn: string };
type Noegletal = { id: number; navn: string; enhed: string; kategori: { navn: string } };
type Vaerdi = { kommuneKode: string; noegletalId: number; vaerdi: string };

type GemStatus = "idle" | "gemmer" | "gemt" | "fejl";

export function VaerdiTabel({
  kommuner,
  noegletal,
  vaerdier,
}: {
  kommuner: Kommune[];
  noegletal: Noegletal[];
  vaerdier: Vaerdi[];
}) {
  const [valgtNoegletalId, setValgtNoegletalId] = useState(noegletal[0].id);
  const [lokaleVaerdier, setLokaleVaerdier] = useState<Record<string, string>>(() => {
    const opslag: Record<string, string> = {};
    for (const v of vaerdier) opslag[`${v.kommuneKode}:${v.noegletalId}`] = v.vaerdi;
    return opslag;
  });
  const [statusPrKommune, setStatusPrKommune] = useState<Record<string, GemStatus>>({});

  const valgtNoegletal = noegletal.find((n) => n.id === valgtNoegletalId)!;

  async function gem(kode: string, raaVaerdi: string) {
    const tal = Number(raaVaerdi.replace(",", "."));
    if (raaVaerdi === "" || Number.isNaN(tal)) return;

    setStatusPrKommune((s) => ({ ...s, [kode]: "gemmer" }));
    try {
      const res = await fetch("/api/admin/vaerdier", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kommuneKode: kode, noegletalId: valgtNoegletalId, vaerdi: tal }),
      });
      if (!res.ok) throw new Error();
      setStatusPrKommune((s) => ({ ...s, [kode]: "gemt" }));
    } catch {
      setStatusPrKommune((s) => ({ ...s, [kode]: "fejl" }));
    }
  }

  const dropdownOptions = useMemo(
    () =>
      noegletal.map((n) => ({
        id: n.id,
        label: `${n.kategori.navn} — ${n.navn} (${n.enhed})`,
      })),
    [noegletal],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 sm:max-w-md">
        <Label>Nøgletal der redigeres</Label>
        <Dropdown>
          <Button variant="outline" className="justify-between">
            {dropdownOptions.find((o) => o.id === valgtNoegletalId)?.label}
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              selectionMode="single"
              selectedKeys={new Set([String(valgtNoegletalId)])}
              onSelectionChange={(keys) => {
                const valgt = Number(Array.from(keys as Set<string>)[0]);
                if (!Number.isNaN(valgt)) setValgtNoegletalId(valgt);
              }}
            >
              {dropdownOptions.map((o) => (
                <Dropdown.Item key={o.id} id={String(o.id)} textValue={o.label}>
                  <Label>{o.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-4 py-2.5 font-medium">Kommune</th>
              <th className="px-4 py-2.5 font-medium">
                Værdi ({valgtNoegletal.enhed})
              </th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {kommuner.map((k) => {
              const noegle = `${k.kode}:${valgtNoegletalId}`;
              const status = statusPrKommune[k.kode];
              return (
                <tr key={k.kode} className="border-t border-border/60">
                  <td className="px-4 py-2 font-medium">{k.navn}</td>
                  <td className="px-4 py-2">
                    <input
                      key={noegle}
                      type="text"
                      inputMode="decimal"
                      defaultValue={lokaleVaerdier[noegle] ?? ""}
                      onBlur={(e) => {
                        setLokaleVaerdier((v) => ({ ...v, [noegle]: e.target.value }));
                        void gem(k.kode, e.target.value);
                      }}
                      className="w-32 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">
                    {status === "gemmer" && "Gemmer…"}
                    {status === "gemt" && "Gemt"}
                    {status === "fejl" && "Kunne ikke gemme"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
