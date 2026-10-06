"use client";

import { useEffect } from "react";

// Sætter fanens titel, når siden skifter indhold uden at blive indlæst forfra. Next.js
// opdaterer ikke titlen fra generateMetadata, når kun adressens søgeparametre ændres
// (fx /sammenlign?kommuner=... ved valg af kommuner), men siden selv tegnes om, så
// titlen følger med herfra. generateMetadata giver stadig titlen ved første indlæsning.
export function DokumentTitel({ titel }: { titel: string }) {
  useEffect(() => {
    document.title = titel;
  }, [titel]);
  return null;
}
