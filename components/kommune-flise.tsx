import Image from "next/image";
import NextLink from "next/link";
import { IconHome } from "@tabler/icons-react";

export type KommuneFliseData = {
  kode: string;
  navn: string;
  slug: string;
  region: string | null;
  harBillede: boolean;
  score: number;
  rang: number;
  antal: number;
};

// Et kort med foto, navn, region og samlet score (standardvægte), som linker til rapporten.
export function KommuneFlise({ kommune }: { kommune: KommuneFliseData }) {
  return (
    <NextLink
      href={`/kommune/${kommune.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface transition-colors hover:border-accent/60"
    >
      <div className="relative h-28 bg-gradient-to-br from-surface-secondary to-accent/10">
        {kommune.harBillede ? (
          <Image
            src={`/kommuner/${kommune.kode}.jpg`}
            alt=""
            fill
            sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <IconHome className="absolute inset-0 m-auto h-7 w-7 text-muted/50" />
        )}
      </div>

      <div className="flex flex-1 items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight text-foreground">{kommune.navn}</p>
          {kommune.region && <p className="mt-0.5 truncate text-xs text-muted">{kommune.region}</p>}
          <p className="mt-2 text-xs tabular-nums text-muted">
            Nr. {kommune.rang} af {kommune.antal}
          </p>
        </div>
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold tabular-nums text-accent-foreground"
          title="Samlet score ud af 100"
        >
          {kommune.score}
        </span>
      </div>
    </NextLink>
  );
}
