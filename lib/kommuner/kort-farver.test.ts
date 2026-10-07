// Tests af kortets farver med standardvægtene (forhåndsvisningen på /kort). Kør med: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import type { KategoriMeta, KommuneScore } from "@/lib/scores/compute";
import { KORT_PALET_STANDARD, KORT_PALETTER, standardKortFarver } from "@/lib/kommuner/kort-farver";

const FARVER = KORT_PALETTER[KORT_PALET_STANDARD].farver;

const meta = (id: number, standardvaegt: number): KategoriMeta => ({
  id,
  navn: `kat${id}`,
  slug: `kat${id}`,
  standardvaegt,
  venlighed: 0,
  ikon: null,
  noegletal: [],
});

const kommune = (kode: string, kategorier: Record<number, number>): KommuneScore => ({
  kode,
  navn: kode,
  samlet: 0,
  kategorier,
  noegletal: {},
  vaerdier: {},
});

test("bedste og dårligste kommune får palettens yderste farver", () => {
  const farver = standardKortFarver(
    [meta(1, 1)],
    [kommune("a", { 1: 90 }), kommune("b", { 1: 75 }), kommune("c", { 1: 60 })],
  );
  assert.equal(farver.a, FARVER.at(-1));
  assert.equal(farver.c, FARVER[0]);
  assert.equal(farver.b, FARVER[6]);
});

test("kategorier uden standardvægt tæller ikke, og en manglende score tæller som 50", () => {
  // Kategori 2 har vægt 0 og ville ellers vende rækkefølgen.
  const farver = standardKortFarver(
    [meta(1, 1), meta(2, 0)],
    [kommune("a", { 1: 80, 2: 50 }), kommune("b", { 1: 70, 2: 100 }), kommune("c", { 2: 100 })],
  );
  assert.equal(farver.a, FARVER.at(-1));
  assert.equal(farver.c, FARVER[0]);
});
