"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Spinner } from "@heroui/react";
import {
  IconAlertTriangle,
  IconCheck,
  IconDownload,
  IconLink,
  IconPrinter,
  IconShare,
} from "@tabler/icons-react";

const ingenAbonnement = () => () => {};

// Reserve, når Clipboard-API'et er blokeret (fx i indlejrede browsere).
function kopierGammeldags(tekst: string) {
  const felt = document.createElement("textarea");
  felt.value = tekst;
  felt.setAttribute("readonly", "");
  felt.style.position = "fixed";
  felt.style.opacity = "0";
  document.body.appendChild(felt);
  felt.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    felt.remove();
  }
}

// Værktøjer øverst på kommunerapporten: del, kopiér link, print og gem som PDF.
// Skjules ved udskrift (data-skjul-ved-print), så de ikke kommer med i PDF'en.
export function RapportVaerktoejer({ kommunenavn, slug }: { kommunenavn: string; slug: string }) {
  // Browserens egen del-menu findes mest på mobil (og i nogle desktop-browsere).
  const kanDele = useSyncExternalStore(
    ingenAbonnement,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [kopieret, setKopieret] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<"klar" | "henter" | "fejl">("klar");
  const nulstilTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(nulstilTimer.current), []);

  const kopierLink = async () => {
    const url = window.location.href;
    let ok = true;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      ok = kopierGammeldags(url);
    }
    if (!ok) return;
    setKopieret(true);
    clearTimeout(nulstilTimer.current);
    nulstilTimer.current = setTimeout(() => setKopieret(false), 2000);
  };

  const del = async () => {
    try {
      await navigator.share({
        title: `${kommunenavn} – kommunerapport`,
        text: `Se kommunerapporten for ${kommunenavn}`,
        url: window.location.href,
      });
    } catch {
      // Brugeren lukkede del-menuen.
    }
  };

  // PDF'en laves på serveren (app/api/kommune/[slug]/pdf) og hentes som fil.
  const gemPdf = async () => {
    setPdfStatus("henter");
    try {
      const svar = await fetch(`/api/kommune/${slug}/pdf`);
      if (!svar.ok) throw new Error(`HTTP ${svar.status}`);
      const url = URL.createObjectURL(await svar.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `kommunerapport-${slug}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setPdfStatus("klar");
    } catch {
      setPdfStatus("fejl");
    }
  };

  const knap = "h-8 gap-1.5 px-2.5 text-sm text-muted hover:text-foreground";

  return (
    <div data-skjul-ved-print className="flex items-center gap-1">
      {kanDele && (
        <Button size="sm" variant="ghost" className={knap} onPress={del}>
          <IconShare className="h-4 w-4" />
          Del
        </Button>
      )}
      <Button size="sm" variant="ghost" className={knap} onPress={kopierLink}>
        {kopieret ? (
          <IconCheck className="h-4 w-4 text-success" />
        ) : (
          <IconLink className="h-4 w-4" />
        )}
        {kopieret ? "Kopieret" : "Kopiér link"}
      </Button>
      <Button size="sm" variant="ghost" className={knap} onPress={() => window.print()}>
        <IconPrinter className="h-4 w-4" />
        Print
      </Button>
      <Button size="sm" variant="ghost" className={knap} isPending={pdfStatus === "henter"} onPress={gemPdf}>
        {pdfStatus === "henter" ? (
          <Spinner size="sm" color="current" />
        ) : pdfStatus === "fejl" ? (
          <IconAlertTriangle className="h-4 w-4 text-danger" />
        ) : (
          <IconDownload className="h-4 w-4" />
        )}
        {pdfStatus === "fejl" ? "Prøv igen" : "Gem som PDF"}
      </Button>
    </div>
  );
}
