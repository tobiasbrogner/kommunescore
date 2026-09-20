"use client";

import { useState } from "react";

type Noegletal = { id: number; navn: string; enhed: string };
type Kategori = { id: number; navn: string; noegletal: Noegletal[] };
type Kommune = { kode: string; navn: string };
type Vaerdi = { kommuneKode: string; noegletalId: number; vaerdi: string };

type CelleStatus = "idle" | "gemmer" | "gemt" | "fejl";

function formatVaerdi(raa: string) {
  const tal = Number(raa);
  return Number.isFinite(tal) ? String(tal) : raa;
}

function erGennemsnit(navn: string) {
  return navn.toLowerCase().includes("gennemsnit");
}

const STATUS_RING: Record<CelleStatus, string> = {
  idle: "focus:border-accent",
  gemmer: "border-accent/50",
  gemt: "border-accent",
  fejl: "border-red-500",
};

export function AlleVaerdierTabel({
  kommuner,
  kategorier,
  vaerdier,
}: {
  kommuner: Kommune[];
  kategorier: Kategori[];
  vaerdier: Vaerdi[];
}) {
  const [lokaleVaerdier, setLokaleVaerdier] = useState<Record<string, string>>(() => {
    const opslag: Record<string, string> = {};
    for (const v of vaerdier) opslag[`${v.kommuneKode}:${v.noegletalId}`] = formatVaerdi(v.vaerdi);
    return opslag;
  });
  const [statusPrCelle, setStatusPrCelle] = useState<Record<string, CelleStatus>>({});

  const kategorierMedNoegletal = kategorier.filter((k) => k.noegletal.length > 0);

  async function gem(kommuneKode: string, noegletalId: number, raaVaerdi: string) {
    const noegle = `${kommuneKode}:${noegletalId}`;
    if (raaVaerdi === "") return;

    const tal = Number(raaVaerdi.replace(",", "."));
    if (Number.isNaN(tal)) {
      setStatusPrCelle((s) => ({ ...s, [noegle]: "fejl" }));
      return;
    }

    setStatusPrCelle((s) => ({ ...s, [noegle]: "gemmer" }));
    try {
      const res = await fetch("/api/admin/vaerdier", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kommuneKode, noegletalId, vaerdi: tal }),
      });
      if (!res.ok) throw new Error();
      setStatusPrCelle((s) => ({ ...s, [noegle]: "gemt" }));
      setTimeout(() => {
        setStatusPrCelle((s) => (s[noegle] === "gemt" ? { ...s, [noegle]: "idle" } : s));
      }, 1500);
    } catch {
      setStatusPrCelle((s) => ({ ...s, [noegle]: "fejl" }));
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-40" />
          {kategorierMedNoegletal.flatMap((k) => k.noegletal.map((n) => <col key={n.id} />))}
        </colgroup>
        <thead className="bg-surface-secondary">
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-10 bg-surface-secondary px-4 py-2.5 font-medium"
            >
              Kommune
            </th>
            {kategorierMedNoegletal.map((k) => (
              <th
                key={k.id}
                colSpan={k.noegletal.length}
                className="border-l border-border px-4 py-2 text-center font-medium"
              >
                {k.navn}
              </th>
            ))}
          </tr>
          <tr>
            {kategorierMedNoegletal.flatMap((k) =>
              k.noegletal.map((n, i) => {
                const fremhaevet = erGennemsnit(n.navn);
                return (
                  <th
                    key={n.id}
                    className={`px-3 py-2 text-xs font-normal text-muted ${
                      fremhaevet
                        ? "border-l border-accent/40 bg-accent/10 font-semibold text-foreground"
                        : i === 0
                          ? "border-l border-border"
                          : ""
                    }`}
                  >
                    {n.navn} ({n.enhed})
                  </th>
                );
              }),
            )}
          </tr>
        </thead>
        <tbody>
          {kommuner.map((kom) => (
            <tr key={kom.kode} className="border-t border-border/60">
              <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium">{kom.navn}</td>
              {kategorierMedNoegletal.flatMap((k) =>
                k.noegletal.map((n, i) => {
                  const noegle = `${kom.kode}:${n.id}`;
                  const status = statusPrCelle[noegle] ?? "idle";
                  const fremhaevet = erGennemsnit(n.navn);
                  return (
                    <td
                      key={n.id}
                      className={`px-2 py-1.5 ${
                        fremhaevet
                          ? "border-l border-accent/30 bg-accent/5"
                          : i === 0
                            ? "border-l border-border"
                            : ""
                      }`}
                    >
                      <input
                        key={noegle}
                        type="text"
                        inputMode="decimal"
                        defaultValue={lokaleVaerdier[noegle] ?? ""}
                        onBlur={(e) => {
                          setLokaleVaerdier((v) => ({ ...v, [noegle]: e.target.value }));
                          void gem(kom.kode, n.id, e.target.value);
                        }}
                        className={`w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm outline-none transition-colors ${STATUS_RING[status]} ${fremhaevet ? "font-semibold text-foreground" : ""}`}
                      />
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
