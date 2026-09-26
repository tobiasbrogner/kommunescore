"use client";

import NextLink from "next/link";
import { linkVariants } from "@heroui/styles";
import { LogudKnap } from "@/components/panel/logud-knap";

const link = linkVariants();

export function PanelNav() {
  return (
    <nav className="flex items-center gap-5">
      <NextLink className={link.base()} href="/panel">
        Overblik
      </NextLink>
      <NextLink className={link.base()} href="/panel/kategorier">
        Kategorier, nøgletal & værdier
      </NextLink>
      <NextLink className={link.base()} href="/panel/kommuner">
        Kommuner
      </NextLink>
      <LogudKnap />
    </nav>
  );
}
