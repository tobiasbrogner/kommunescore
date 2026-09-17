"use client";

import NextLink from "next/link";
import { Link } from "@heroui/react";

export function SiteFooter() {
  const aar = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface-secondary/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          Danmarkskortet
        </p>

        <nav
          aria-label="Footer navigation"
          className="flex items-center gap-6 text-sm"
        >
          <Link as={NextLink} href="/">
            Forside
          </Link>
          <Link as={NextLink} href="/kort">
            Kort
          </Link>
        </nav>

        <p className="text-xs text-muted">© {aar} Danmarkskortet</p>
      </div>
    </footer>
  );
}
