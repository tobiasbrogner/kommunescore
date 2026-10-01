import type { BilledKredit } from "@/lib/kommuner/billeder";

// Krediteringen, som Creative Commons-licenserne kræver: fotograf, licens og link til
// billedets side på Wikimedia Commons. Fotos er beskåret, så det nævnes.
export function BilledKreditTekst({ kredit }: { kredit: BilledKredit }) {
  const offentligt = /^(CC0|Public domain|PD)/i.test(kredit.licens);
  return (
    <>
      Foto:{" "}
      <a href={kredit.side} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        {kredit.fotograf}
      </a>
      ,{" "}
      {kredit.licensUrl ? (
        <a
          href={kredit.licensUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          {kredit.licens}
        </a>
      ) : (
        kredit.licens
      )}
      {!offentligt && " (beskåret)"}
    </>
  );
}
