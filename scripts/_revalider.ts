// Rydder Next.js' cache af kommune-scores via app/api/intern/revalider, så
// data fra et seed-script vises med det samme på /kort. Fejler blødt: kører
// dev-serveren ikke, skrives blot en besked i stedet for at vælte scriptet.
export async function revaliderScores() {
  const hemmelighed = process.env.REVALIDATE_SECRET;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  if (!hemmelighed) {
    console.warn("REVALIDATE_SECRET mangler i .env.local — cachen blev ikke ryddet.");
    return;
  }

  try {
    const svar = await fetch(`${appUrl}/api/intern/revalider`, {
      method: "POST",
      headers: { "x-revalidate-secret": hemmelighed },
    });
    if (!svar.ok) throw new Error(`HTTP ${svar.status}`);
    console.log("Cachen for kommune-scores er ryddet — de nye data vises med det samme.");
  } catch (err) {
    console.warn(
      `Kunne ikke rydde cachen via ${appUrl} (${err instanceof Error ? err.message : err}). ` +
        "Kører dev-serveren? Ellers genstart den, før de nye data vises.",
    );
  }
}
