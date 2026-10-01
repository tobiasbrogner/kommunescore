"use client";

import { useState, type FormEvent } from "react";
import NextLink from "next/link";
import { LogoMark } from "@/components/logo";

// Linkkolonner i det blå bånd. Nye sider tilføjes her, efterhånden som de kommer.
const linkGrupper: { href: string; label: string }[][] = [
  [
    { href: "/", label: "Forside" },
    { href: "/kort", label: "Udforsk kortet" },
    { href: "/saadan-virker-det", label: "Sådan virker det" },
    { href: "/kilder", label: "Kilder" },
  ],
];

export function SiteFooter() {
  const aar = new Date().getFullYear();
  const [tilmeldt, setTilmeldt] = useState(false);

  // Nyhedsbrevet har endnu ingen backend – formularen kvitterer blot.
  function tilmeld(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTilmeldt(true);
  }

  return (
    <footer data-site-footer>
      <div className="bg-(--footer) text-white">
        <div className="mx-auto grid max-w-7xl px-4 sm:px-6 lg:grid-cols-[3fr_2fr] lg:px-8">
          <div className="grid gap-10 py-12 sm:grid-cols-[minmax(0,12rem)_1fr] lg:pr-10">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <p className="font-logo text-lg font-bold">Kommuna</p>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Find et sted i Danmark, der passer til dit liv.
                </p>
              </div>
              <LogoMark className="size-12" hvid />
            </div>

            <nav aria-label="Footer navigation" className="grid content-start gap-8 sm:grid-cols-2">
              {linkGrupper.map((gruppe, i) => (
                <ul key={i}>
                  {gruppe.map((l) => (
                    <li key={l.href}>
                      <NextLink
                        href={l.href}
                        className="block border-b border-white/25 py-2.5 text-sm text-white/90 transition-colors hover:text-white hover:border-white/60"
                      >
                        {l.label}
                      </NextLink>
                    </li>
                  ))}
                </ul>
              ))}
            </nav>
          </div>

          <div className="-mx-4 bg-(--footer-panel) px-4 py-12 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-10">
            <h2 className="text-base font-semibold tracking-tight">
              De bedste nyheder direkte i din indbakke
            </h2>
            <p className="mt-2 text-sm text-white/80">
              Bliv opdateret, når der kommer nye data og funktioner på kortet.
            </p>

            {tilmeldt ? (
              <p role="status" className="mt-8 text-sm text-white/90">
                Tak! Nyhedsbrevet er på vej – vi giver besked, så snart det åbner.
              </p>
            ) : (
              <form onSubmit={tilmeld} className="mt-6 flex flex-col gap-5">
                <label className="block">
                  <span className="sr-only">Navn</span>
                  <input
                    name="navn"
                    autoComplete="name"
                    placeholder="Navn"
                    className="w-full border-b border-white/40 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/75 focus:border-white"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">E-mail</span>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="E-mail"
                    className="w-full border-b border-white/40 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/75 focus:border-white"
                  />
                </label>
                <button
                  type="submit"
                  className="self-end rounded-md border border-white px-4 py-2 text-sm font-medium transition-colors hover:bg-white hover:text-(--footer) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Tilmeld
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm sm:px-6 lg:px-8">
          <p>
            <span className="font-semibold text-accent">Kommuna</span>
            <span className="text-muted"> – find et sted, der passer til dit liv</span>
          </p>
          <p className="text-xs text-muted">© {aar} Kommuna</p>
        </div>
      </div>
    </footer>
  );
}
