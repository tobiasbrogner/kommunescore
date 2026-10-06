"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Feedback-vinduet bruger mange formularkomponenter, men åbnes sjældent. Derfor hentes
// det først, første gang det åbnes, i stedet for at være med i koden på hver side
// (header og footer). Bagefter bliver det hængende, så lukke-animationen virker.
const FeedbackModal = dynamic(
  () => import("@/components/feedback-modal").then((m) => m.FeedbackModal),
  { ssr: false },
);

export function FeedbackModalLazy({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const [hentet, setHentet] = useState(false);
  // Sat under tegningen (ikke i en effekt), så vinduet hentes i samme omgang, som det åbnes.
  if (isOpen && !hentet) setHentet(true);
  return hentet ? <FeedbackModal isOpen={isOpen} onOpenChange={onOpenChange} /> : null;
}
