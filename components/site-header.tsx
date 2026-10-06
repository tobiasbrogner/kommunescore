"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Description, Dropdown, Label } from "@heroui/react";
import {
  IconArrowsLeftRight,
  IconChecklist,
  IconChevronDown,
  IconDatabase,
  IconInfoCircle,
  IconMap,
} from "@tabler/icons-react";
import { buttonVariants, linkVariants } from "@heroui/styles";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { FeedbackModal } from "@/components/feedback-modal";
const link = linkVariants();

// Topmenuens punkter samles i dropdown-menuer, så der er plads til flere sider.
const VAERKTOEJER = [
  { href: "/kort", navn: "Kortet", tekst: "Find din kommune på kortet", Ikon: IconMap },
  { href: "/kommunetest", navn: "Kommunetesten", tekst: "20 spørgsmål finder din top 6", Ikon: IconChecklist },
  { href: "/sammenlign", navn: "Sammenlign rapporter", tekst: "Stil kommuner op side om side", Ikon: IconArrowsLeftRight },
];

// Sider om Kommuna selv. "Om os" kommer her, når siden findes.
const OM_KOMMUNA = [
  { href: "/saadan-virker-det", navn: "Sådan virker det", tekst: "Hvordan scoren regnes ud", Ikon: IconInfoCircle },
  { href: "/kilder", navn: "Kilder", tekst: "Hvor tallene kommer fra", Ikon: IconDatabase },
];

const MENUER = [
  { titel: "Om Kommuna", punkter: OM_KOMMUNA },
  { titel: "Værktøjer", punkter: VAERKTOEJER },
];

type MenuPunkt = (typeof VAERKTOEJER)[number];

// Med mus åbner menuen ved hover (med en lille forsinkelse, så den ikke blinker, når
// musen blot passerer). Klik og tastatur virker stadig, så touch og skærmlæsere er dækket.
const AABN_FORSINKELSE = 150;
const LUK_FORSINKELSE = 200;

function NavMenu({ titel, punkter }: { titel: string; punkter: MenuPunkt[] }) {
  const router = useRouter();
  const [aaben, setAaben] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const musKlik = useRef(false);

  const planlaeg = (vaerdi: boolean, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAaben(vaerdi), ms);
  };
  const vedEnter = (e: PointerEvent) => {
    if (e.pointerType === "mouse") planlaeg(true, AABN_FORSINKELSE);
  };
  const vedLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") planlaeg(false, LUK_FORSINKELSE);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Dropdown
      isOpen={aaben}
      onOpenChange={(vaerdi) => {
        clearTimeout(timer.current);
        // Er menuen allerede åbnet ved hover, skal et klik på knappen ikke lukke den igen.
        if (!vaerdi && musKlik.current) return;
        setAaben(vaerdi);
      }}
    >
      <Dropdown.Trigger
        className={`${link.base()} inline-flex cursor-pointer items-center gap-1 data-[pressed=true]:no-underline`}
        onPointerEnter={vedEnter}
        onPointerLeave={vedLeave}
        onPointerDown={(e) => {
          musKlik.current = e.pointerType === "mouse";
        }}
        onPointerUp={() => {
          setTimeout(() => (musKlik.current = false));
        }}
      >
        {titel}
        <IconChevronDown className={`h-4 w-4 transition-transform ${aaben ? "rotate-180" : ""}`} />
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-[260px]" isNonModal>
        <div onPointerEnter={vedEnter} onPointerLeave={vedLeave}>
          <Dropdown.Menu aria-label={titel} onAction={(href) => router.push(String(href))}>
            {punkter.map(({ href, navn, tekst, Ikon }) => (
              <Dropdown.Item key={href} id={href} textValue={navn}>
                <Ikon className="h-5 w-5 shrink-0 text-muted" />
                <div className="flex flex-col">
                  <Label>{navn}</Label>
                  <Description>{tekst}</Description>
                </div>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </div>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Kortsiden er bredere end resten af sitet; headeren følger med, så den flugter med værktøjslinjen.
  const bredde = usePathname().startsWith("/kort") ? "max-w-[1600px]" : "max-w-7xl";

  return (
    <header data-skjul-ved-print className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <nav
        aria-label="Primær navigation"
        className={`mx-auto flex h-18 ${bredde} items-center justify-between px-4 sm:px-6 lg:px-8`}
      >
        <NextLink href="/" className="flex items-center text-foreground">
          <Logo className="h-9" />
        </NextLink>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-8 md:flex">
            {MENUER.map(({ titel, punkter }) => (
              <NavMenu key={titel} titel={titel} punkter={punkter} />
            ))}

            <button
              type="button"
              className={`${link.base()} cursor-pointer`}
              onClick={() => setFeedbackOpen(true)}
            >
              Feedback
            </button>

            <NextLink className={buttonVariants({ variant: "primary", size: "md" })} href="/kort">
              Kom i gang
            </NextLink>
          </div>

          <ThemeToggle />

          <Button
            className="md:hidden"
            variant="ghost"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onPress={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Luk" : "Menu"}
          </Button>
        </div>
      </nav>

      {menuOpen && (
        <div
          id="mobile-navigation"
          className="border-t border-border bg-background px-4 py-4 md:hidden"
        >
          <div className={`mx-auto flex ${bredde} flex-col gap-2`}>
            {MENUER.map(({ titel, punkter }, i) => (
              <div key={titel} className={`flex flex-col gap-2 ${i > 0 ? "mt-2" : ""}`}>
                <p className="px-3 pt-1 text-xs font-medium uppercase tracking-wide text-muted">{titel}</p>
                {punkter.map(({ href, navn }) => (
                  <NextLink
                    key={href}
                    href={href}
                    className={`${link.base()} px-3 py-3`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {navn}
                  </NextLink>
                ))}
              </div>
            ))}

            <button
              type="button"
              className={`${link.base()} mt-2 cursor-pointer px-3 py-3 text-left`}
              onClick={() => {
                setMenuOpen(false);
                setFeedbackOpen(true);
              }}
            >
              Feedback
            </button>

            <NextLink
              href="/kort"
              className={`${buttonVariants({ variant: "primary" })} mt-2`}
              onClick={() => setMenuOpen(false)}
            >
              Kom i gang
            </NextLink>
          </div>
        </div>
      )}

      <FeedbackModal isOpen={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </header>
  );
}