"use client";

import { useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { buttonVariants, linkVariants } from "@heroui/styles";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo";
import { FeedbackModal } from "@/components/feedback-modal";
const link = linkVariants();

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Kortsiden er bredere end resten af sitet; headeren følger med, så den flugter med værktøjslinjen.
  const bredde = usePathname().startsWith("/kort") ? "max-w-[1600px]" : "max-w-7xl";

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <nav
        aria-label="Primær navigation"
        className={`mx-auto flex h-18 ${bredde} items-center justify-between px-4 sm:px-6 lg:px-8`}
      >
        <NextLink
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
        >
          <LogoMark className="size-9" />
          Logo Her
        </NextLink>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-8 md:flex">
            <button
              type="button"
              className={`${link.base()} cursor-pointer`}
              onClick={() => setFeedbackOpen(true)}
            >
              Feedback
            </button>

            <NextLink className={link.base()} href="/kort">
              Udforsk
            </NextLink>

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
            <button
              type="button"
              className={`${link.base()} cursor-pointer px-3 py-3 text-left`}
              onClick={() => {
                setMenuOpen(false);
                setFeedbackOpen(true);
              }}
            >
              Feedback
            </button>

            <NextLink
              href="/kort"
              className={`${link.base()} px-3 py-3`}
              onClick={() => setMenuOpen(false)}
            >
              Udforsk
            </NextLink>

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