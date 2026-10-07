// Kopierer tekst (fx et link) til udklipsholderen i browseren. Bruges af Del- og
// Kopiér link-knapperne på kommunerapporten og i kommunetesten.

// Reserve, når Clipboard-API'et er blokeret (fx i indlejrede browsere).
function kopierGammeldags(tekst: string) {
  const felt = document.createElement("textarea");
  felt.value = tekst;
  felt.setAttribute("readonly", "");
  felt.style.position = "fixed";
  felt.style.opacity = "0";
  document.body.appendChild(felt);
  felt.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    felt.remove();
  }
}

/** true, når teksten blev kopieret. */
export async function kopierTekst(tekst: string) {
  try {
    await navigator.clipboard.writeText(tekst);
    return true;
  } catch {
    return kopierGammeldags(tekst);
  }
}
