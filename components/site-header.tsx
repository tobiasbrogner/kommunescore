"use client";

import { useState } from "react";
import NextLink from "next/link";
import { Button, Link } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <nav
        aria-label="Primær navigation"
        className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Link
          as={NextLink}
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Danmarkskortet
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-8 md:flex">
            <Link as={NextLink} href="/kort">
              Kort
            </Link>

            <Button
              as={NextLink}
              href="/kort"
              variant="primary"
              size="md"
            >
              Kom i gang
            </Button>
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
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            <Link
              as={NextLink}
              href="/kort"
              className="px-3 py-3"
              onPress={() => setMenuOpen(false)}
            >
              Kort
            </Link>

            <Button
              as={NextLink}
              href="/kort"
              variant="primary"
              className="mt-2"
              onPress={() => setMenuOpen(false)}
            >
              Kom i gang
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}