"use client";

import { useState } from "react";
import NextLink from "next/link";
import { Logo, LogoMark } from "@/components/logo";
import { FeedbackModalLazy } from "@/components/feedback-modal-lazy";

// Linkkolonner i det blå bånd. Nye sider tilføjes her, efterhånden som de kommer.
const linkGrupper: { titel: string; links: { href: string; label: string }[] }[] = [
  {
    titel: "Generelt",
    links: [
      { href: "/kommuner", label: "Alle kommuner" },
      { href: "/saadan-virker-det", label: "Sådan virker det" },
      { href: "/kilder", label: "Kilder" },
      { href: "/privatlivspolitik", label: "Privatlivspolitik" },
    ],
  },
  {
    titel: "Værktøjer",
    links: [
      { href: "/kort", label: "Kortet" },
      { href: "/kommunetest", label: "Kommunetesten" },
      { href: "/sammenlign", label: "Sammenlign rapporter" },
    ],
  },
];

export function SiteFooter() {
  const aar = new Date().getFullYear();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer data-site-footer>
      <div className="bg-(--footer) text-white">
        <div className="mx-auto grid max-w-7xl px-4 sm:px-6 lg:grid-cols-[3fr_2fr] lg:px-8">
          <div className="grid gap-10 py-12 sm:grid-cols-[minmax(0,12rem)_1fr] lg:pr-10">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <NextLink href="/" aria-label="Kommuna – til forsiden" className="inline-block">
                  <Logo hvid className="h-6" />
                </NextLink>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Find den kommune, der passer til dit liv.
                </p>
              </div>
              <NextLink href="/" aria-label="Til forsiden" className="self-center">
                <LogoMark className="h-12" hvid />
              </NextLink>
            </div>

            <nav aria-label="Footer navigation" className="grid content-start gap-8 sm:grid-cols-2">
              {linkGrupper.map((gruppe) => (
                <div key={gruppe.titel}>
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                    {gruppe.titel}
                  </h2>
                  <ul>
                    {gruppe.links.map((l) => (
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
                </div>
              ))}
            </nav>
          </div>

          {/* Nyhedsbrevet kommer, når der er et rigtigt mailsystem; indtil da beder panelet om
              feedback, som gemmes via den samme formular som "Feedback" i headeren. */}
          <div className="-mx-4 bg-(--footer-panel) px-4 py-12 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-10">
            <h2 className="text-base font-semibold tracking-tight">Mangler der noget?</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              Kommuna er under udvikling. Har du idéer til nye tal, eller har du fundet en fejl,
              hører vi gerne fra dig.
            </p>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="mt-6 rounded-md border border-white px-4 py-2 text-sm font-medium transition-colors hover:bg-white hover:text-(--footer) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Giv feedback
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm sm:px-6 lg:px-8">
          <p>
            <span className="font-semibold text-accent">Kommuna</span>
            <span className="text-muted"> – find den kommune, der passer til dit liv</span>
          </p>
          <p className="text-xs text-muted">© {aar} Kommuna</p>
        </div>
      </div>
      <FeedbackModalLazy isOpen={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </footer>
  );
}
