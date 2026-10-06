// Tests af "Kommuner, der ligner". Kør med: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import type { KategoriMeta, KommuneScore } from "@/lib/scores/compute";
import { lignendeKommuner } from "@/lib/scores/lignende";

const meta = (id: number, slug: string, noegletal: { id: number; navn: string }[] = []): KategoriMeta => ({
  id,
  navn: slug,
  slug,
  standardvaegt: 1,
  venlighed: 0,
  ikon: null,
  noegletal: noegletal.map((n) => ({ ...n, enhed: "", beskrivelse: null, skala: "lineaer", standardValgt: true })),
});

// Kategori 1 og 2 er almindelige; Indbyggertal har størrelse (10) og tæthed (11).
const KATEGORIER = [
  meta(1, "natur"),
  meta(2, "tryghed"),
  meta(3, "indbyggertal", [
    { id: 10, navn: "Indbyggere" },
    { id: 11, navn: "Indbyggere pr. km²" },
  ]),
];

const kommune = (kode: string, natur: number, tryghed: number, stoerrelse?: number): KommuneScore => ({
  kode,
  navn: kode,
  samlet: 75,
  kategorier: { 1: natur, 2: tryghed, 3: 99 },
  noegletal: stoerrelse === undefined ? {} : { 10: stoerrelse, 11: stoerrelse },
  vaerdier: {},
});

test("de kommuner med de nærmeste scorer kommer først", () => {
  const kommuner = [kommune("a", 60, 60), kommune("b", 62, 61), kommune("c", 90, 90), kommune("d", 70, 70)];
  const r = lignendeKommuner("a", kommuner, KATEGORIER);
  assert.deepEqual(r.map((k) => k.kode), ["b", "d", "c"]);
});

test("kommunen selv er aldrig med, og der vises højst det ønskede antal", () => {
  const kommuner = ["a", "b", "c", "d", "e", "f"].map((k, i) => kommune(k, 50 + i, 50 + i));
  const r = lignendeKommuner("c", kommuner, KATEGORIER, 4);
  assert.equal(r.length, 4);
  assert.equal(r.some((k) => k.kode === "c"), false);
});

test("størrelsen tæller med, så en by ligner en by", () => {
  // b har næsten samme scorer som a, men er lille; c er lidt længere væk, men lige så stor.
  const kommuner = [kommune("a", 70, 70, 100), kommune("b", 72, 72, 50), kommune("c", 76, 76, 100)];
  assert.equal(lignendeKommuner("a", kommuner, KATEGORIER)[0].kode, "c");
});

test("indbyggertal-kategorien tæller ikke som almindelig kategori", () => {
  const a = kommune("a", 60, 60);
  const b = { ...kommune("b", 60, 60), kategorier: { 1: 60, 2: 60, 3: 50 } };
  const c = kommune("c", 61, 61);
  // b er helt ens i de almindelige kategorier og skal derfor stå før c.
  assert.equal(lignendeKommuner("a", [a, b, c], KATEGORIER)[0].kode, "b");
});

test("en ukendt kommune giver ingen forslag", () => {
  assert.deepEqual(lignendeKommuner("findes-ikke", [kommune("a", 60, 60)], KATEGORIER), []);
});
