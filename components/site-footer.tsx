"use client";

import NextLink from "next/link";
import { linkVariants } from "@heroui/styles";

const link = linkVariants();

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
          <NextLink className={link.base()} href="/">
            Forside
          </NextLink>
          <NextLink className={link.base()} href="/kort">
            Udforsk
          </NextLink>
        </nav>

        <p className="text-xs text-muted">© {aar} Danmarkskortet</p>
      </div>
    </footer>
  );
}
