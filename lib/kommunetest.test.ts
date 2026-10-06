// Tests af kommunetesten: fra svar til vægte og fra vægte til top 6. Kør med: pnpm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { byggPrioritet, findMatch, HELE_LANDET, type TestPrioritet } from "@/lib/kommunetest";
import type { KategoriMeta, KommuneScore } from "@/lib/scores/compute";

const SLUGS = [
  "boligpriser",
  "kommuneskat",
  "boern",
  "jobmuligheder",
  "pendling",
  "tryghed",
  "sundhed",
  "aeldre",
  "natur",
  "spisesteder",
  "idraet",
  "indbyggertal",
];

// Kategorierne som i databasen; kun Indbyggertal har nøgletal, da testene bruger dem.
const KATEGORIER: KategoriMeta[] = SLUGS.map((slug, i) => ({
  id: i + 1,
  navn: slug,
  slug,
  standardvaegt: 1,
  venlighed: 0,
  ikon: null,
  noegletal:
    slug === "indbyggertal"
      ? [
          { id: 100, navn: "Indbyggere", enhed: "", beskrivelse: null, skala: "logaritmisk", standardValgt: true },
          { id: 101, navn: "Indbyggere pr. km²", enhed: "", beskrivelse: null, skala: "logaritmisk", standardValgt: false },
        ]
      : [],
}));
const id = (slug: string) => KATEGORIER.find((k) => k.slug === slug)!.id;

describe("byggPrioritet", () => {
  test("lejere vægter boligpriser halvt og slipper for grundskyld", () => {
    const p = byggPrioritet({ bolig: "leje", boligpriser: 100 }, KATEGORIER);
    assert.equal(p.vaegte.boligpriser, 50);
    assert.deepEqual(p.noegletal.kommuneskat, ["kommuneskat"]);
  });

  test("huskøbere tæller kun huspriser", () => {
    const p = byggPrioritet({ bolig: "hus" }, KATEGORIER);
    assert.deepEqual(p.noegletal.boligpriser, ["hus"]);
  });

  test("det vigtigste får fuld vægt, og resten tæller 80 % i trin på 5", () => {
    const p = byggPrioritet({ natur: 75, tryghed: 50, vigtigst: "natur" }, KATEGORIER);
    assert.equal(p.vaegte.natur, 100);
    assert.equal(p.vaegte.tryghed, 40);
    for (const [slug, v] of Object.entries(p.vaegte)) {
      assert.equal(v % 5, 0, `${slug} har vægt ${v}`);
      assert.ok(v >= 0 && v <= 100, `${slug} har vægt ${v}`);
    }
  });

  test("uden børn tæller børnepasning ikke", () => {
    assert.equal(byggPrioritet({ boern: "nej", boernepasning: 100 }, KATEGORIER).vaegte.boern, 0);
    assert.equal(byggPrioritet({ boern: "ja", boernepasning: 100 }, KATEGORIER).vaegte.boern, 100);
  });

  test("landet belønner lav tæthed", () => {
    const p = byggPrioritet({ sted: "landet" }, KATEGORIER);
    assert.deepEqual(p.noegletal.indbyggertal, ["lav-taethed"]);
    assert.ok(p.vaegte.indbyggertal > 0);
  });

  test("kategorier, der ikke findes, kommer ikke med i vægtene", () => {
    const p = byggPrioritet({}, KATEGORIER.filter((k) => k.slug !== "aeldre"));
    assert.equal("aeldre" in p.vaegte, false);
  });

  test("hele landet betyder ingen begrænsning på område", () => {
    assert.equal(byggPrioritet({ omraade: [HELE_LANDET, "fyn"] }, KATEGORIER).omraader, null);
    assert.deepEqual(byggPrioritet({ omraade: ["fyn"] }, KATEGORIER).omraader, ["fyn"]);
    assert.equal(byggPrioritet({ oe: "nej" }, KATEGORIER).udenOeer, true);
  });
});

describe("findMatch", () => {
  const score = (kode: string, kategorier: Record<string, number>, noegletal: Record<number, number> = {}): KommuneScore => ({
    kode,
    navn: kode,
    samlet: 75,
    kategorier: Object.fromEntries(Object.entries(kategorier).map(([slug, s]) => [id(slug), s])),
    noegletal,
    vaerdier: {},
  });
  const prioritet = (felter: Partial<TestPrioritet>): TestPrioritet => ({
    vaegte: {},
    fra: [],
    noegletal: {},
    omraader: null,
    udenOeer: false,
    ...felter,
  });
  const KOMMUNER = [
    { kode: "0101", regionskode: "1084" }, // København
    { kode: "0751", regionskode: "1082" }, // Aarhus
    { kode: "0400", regionskode: "1084" }, // Bornholm
  ];

  test("sorterer efter den vægtede score", () => {
    const scorer = [
      score("0101", { natur: 50, tryghed: 100 }),
      score("0751", { natur: 100, tryghed: 50 }),
    ];
    const r = findMatch(prioritet({ vaegte: { natur: 100, tryghed: 25 } }), KATEGORIER, scorer, KOMMUNER);
    assert.deepEqual(r.map((m) => m.kode), ["0751", "0101"]);
    assert.equal(r[0].score, (100 * 100 + 50 * 25) / 125);
  });

  test("øer uden bro og kommuner uden for området falder fra", () => {
    const scorer = KOMMUNER.map((k) => score(k.kode, { natur: 80 }));
    const udenOeer = findMatch(prioritet({ vaegte: { natur: 50 }, udenOeer: true }), KATEGORIER, scorer, KOMMUNER);
    assert.deepEqual(udenOeer.map((m) => m.kode).sort(), ["0101", "0751"]);

    const midt = findMatch(prioritet({ vaegte: { natur: 50 }, omraader: ["midtjylland"] }), KATEGORIER, scorer, KOMMUNER);
    assert.deepEqual(midt.map((m) => m.kode), ["0751"]);
  });

  test("lav tæthed vender tæthedens score, så de tyndt befolkede vinder", () => {
    const scorer = [score("0101", {}, { 101: 100 }), score("0751", {}, { 101: 50 })];
    const r = findMatch(
      prioritet({ vaegte: { indbyggertal: 75 }, noegletal: { indbyggertal: ["lav-taethed"] } }),
      KATEGORIER,
      scorer,
      KOMMUNER,
    );
    assert.equal(r[0].kode, "0751");
    assert.equal(r[0].score, 100);
    assert.equal(r[1].score, 50);
  });

  test("styrker er kun ting, brugeren vægter mindst middel, og kommunen scorer højt i", () => {
    const scorer = [score("0751", { natur: 90, tryghed: 95, sundhed: 60 })];
    const [m] = findMatch(
      prioritet({ vaegte: { natur: 75, tryghed: 25, sundhed: 100 } }),
      KATEGORIER,
      scorer,
      KOMMUNER,
    );
    assert.deepEqual(m.styrker, ["Natur"]);
  });
});
