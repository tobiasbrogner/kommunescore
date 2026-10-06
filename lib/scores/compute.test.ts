// Tests af scoreberegningen (beregnScores). Kør med: pnpm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  beregnScores,
  omvendtScore,
  venlighedTilEksponent,
  type KategoriMeta,
  type RaaVaerdi,
  type Skala,
} from "@/lib/scores/compute";

// Små hjælpere, så hver test kun skriver det, den handler om.
function kategori(
  id: number,
  noegletal: { id: number; navn?: string; skala?: Skala; standardValgt?: boolean }[],
  felter: Partial<KategoriMeta> = {},
): KategoriMeta {
  return {
    id,
    navn: `Kategori ${id}`,
    slug: `kategori-${id}`,
    standardvaegt: 1,
    venlighed: 0,
    ikon: null,
    noegletal: noegletal.map((n) => ({
      id: n.id,
      navn: n.navn ?? `Nøgletal ${n.id}`,
      enhed: "",
      beskrivelse: null,
      skala: n.skala ?? "lineaer",
      standardValgt: n.standardValgt ?? true,
    })),
    ...felter,
  };
}

function kommuner(antal: number) {
  return Array.from({ length: antal }, (_, i) => ({ kode: `k${i + 1}`, navn: `Kommune ${i + 1}` }));
}

/** Én værdi pr. kommune (k1, k2, ...) for ét nøgletal. */
function vaerdier(
  noegletalId: number,
  kategoriId: number,
  tal: number[],
  retning: RaaVaerdi["retning"] = "hoejere_bedre",
): RaaVaerdi[] {
  return tal.map((vaerdi, i) => ({ kommuneKode: `k${i + 1}`, noegletalId, kategoriId, retning, vaerdi }));
}

function scorePr(resultat: ReturnType<typeof beregnScores>, kode: string) {
  const s = resultat.find((r) => r.kode === kode);
  assert.ok(s, `mangler ${kode}`);
  return s;
}

describe("venlighedTilEksponent", () => {
  test("0 er lineær, 50 er kvadratrod og 100 er fjerderod", () => {
    assert.equal(venlighedTilEksponent(0), 1);
    assert.equal(venlighedTilEksponent(50), 0.5);
    assert.equal(venlighedTilEksponent(100), 0.25);
  });

  test("værdier uden for 0-100 holdes inden for", () => {
    assert.equal(venlighedTilEksponent(-20), 1);
    assert.equal(venlighedTilEksponent(250), 0.25);
  });
});

describe("beregnScores", () => {
  test("bedste kommune får 100, dårligste 50, og alle ligger imellem", () => {
    const tal = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const r = beregnScores(kommuner(10), [kategori(1, [{ id: 1 }])], vaerdier(1, 1, tal));
    assert.equal(scorePr(r, "k10").samlet, 100);
    assert.equal(scorePr(r, "k1").samlet, 50);
    for (const s of r) {
      assert.ok(s.samlet >= 50 && s.samlet <= 100, `${s.kode} har ${s.samlet}`);
    }
  });

  test("højere tal giver højere score, når højere er bedre", () => {
    const r = beregnScores(kommuner(5), [kategori(1, [{ id: 1 }])], vaerdier(1, 1, [5, 1, 4, 2, 3]));
    const raekkefoelge = [...r].sort((a, b) => b.samlet - a.samlet).map((s) => s.kode);
    assert.deepEqual(raekkefoelge, ["k1", "k3", "k5", "k4", "k2"]);
  });

  test("lavere tal giver højere score, når lavere er bedst (fx boligpriser)", () => {
    const r = beregnScores(
      kommuner(5),
      [kategori(1, [{ id: 1 }])],
      vaerdier(1, 1, [5, 1, 4, 2, 3], "lavere_bedre"),
    );
    assert.equal(scorePr(r, "k2").samlet, 100);
    assert.equal(scorePr(r, "k1").samlet, 50);
  });

  test("én ekstrem kommune presser ikke alle andre ned i bunden", () => {
    // 20 almindelige kommuner (1-20) og én med et ekstremt tal. Skalaen går fra 5. til 95.
    // percentil, så den ekstreme får bare topscoren, og de andre spredes over hele skalaen.
    const tal = [...Array.from({ length: 20 }, (_, i) => i + 1), 1000];
    const r = beregnScores(kommuner(21), [kategori(1, [{ id: 1 }])], vaerdier(1, 1, tal));
    assert.equal(scorePr(r, "k21").samlet, 100);
    assert.equal(scorePr(r, "k20").samlet, 100);
    // Midten ligger midt på skalaen og ikke tæt på 50, som den ville uden beskæring.
    assert.ok(scorePr(r, "k10").samlet > 70, `k10 har ${scorePr(r, "k10").samlet}`);
  });

  test("venlighed løfter midten, men bevarer bund, top og rækkefølge", () => {
    const tal = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const lineaer = beregnScores(kommuner(10), [kategori(1, [{ id: 1 }])], vaerdier(1, 1, tal));
    const venlig = beregnScores(
      kommuner(10),
      [kategori(1, [{ id: 1 }], { venlighed: 50 })],
      vaerdier(1, 1, tal),
    );
    assert.equal(scorePr(venlig, "k1").samlet, 50);
    assert.equal(scorePr(venlig, "k10").samlet, 100);
    assert.ok(scorePr(venlig, "k5").samlet > scorePr(lineaer, "k5").samlet);
    const raekke = (r: typeof venlig) => [...r].sort((a, b) => b.samlet - a.samlet).map((s) => s.kode);
    assert.deepEqual(raekke(venlig), raekke(lineaer));
  });

  test("med logaritmisk skala tæller en fordobling lige meget i bund og top", () => {
    // 1, 2, 4, ..., 512: hver kommune har dobbelt så meget som den forrige.
    const tal = Array.from({ length: 10 }, (_, i) => 2 ** i);
    const r = beregnScores(
      kommuner(10),
      [kategori(1, [{ id: 1, skala: "logaritmisk" }])],
      vaerdier(1, 1, tal),
    );
    const spring = (a: string, b: string) => scorePr(r, b).samlet - scorePr(r, a).samlet;
    assert.ok(Math.abs(spring("k3", "k4") - spring("k7", "k8")) < 0.2);
  });

  test("kategoriens score er gennemsnittet af dens nøgletal", () => {
    // Nøgletal 1 og 2 peger hver sin vej, så alle ender på 75.
    const r = beregnScores(
      kommuner(3),
      [kategori(1, [{ id: 1 }, { id: 2 }])],
      [...vaerdier(1, 1, [1, 2, 3]), ...vaerdier(2, 1, [3, 2, 1])],
    );
    for (const s of r) assert.equal(s.kategorier[1], 75);
  });

  test("tilvalgte nøgletal tæller ikke i kategorien, men får deres egen score", () => {
    const r = beregnScores(
      kommuner(3),
      [kategori(1, [{ id: 1 }, { id: 2, standardValgt: false }])],
      [...vaerdier(1, 1, [1, 2, 3]), ...vaerdier(2, 1, [3, 2, 1])],
    );
    assert.equal(scorePr(r, "k3").kategorier[1], 100);
    assert.equal(scorePr(r, "k3").noegletal[2], 50);
  });

  test("en kategori uden tal for kommunen giver bundscoren", () => {
    const r = beregnScores(
      kommuner(3),
      [kategori(1, [{ id: 1 }])],
      vaerdier(1, 1, [1, 2]), // k3 mangler
    );
    assert.equal(scorePr(r, "k3").kategorier[1], 50);
    assert.deepEqual(scorePr(r, "k3").noegletal, {});
  });

  test("den samlede score vægter kategorierne efter standardvægten", () => {
    // Kategori 1 (vægt 3): k2 er bedst. Kategori 2 (vægt 1): k1 er bedst.
    const kategorier = [
      kategori(1, [{ id: 1 }], { standardvaegt: 3 }),
      kategori(2, [{ id: 2 }], { standardvaegt: 1 }),
    ];
    const r = beregnScores(kommuner(2), kategorier, [...vaerdier(1, 1, [1, 2]), ...vaerdier(2, 2, [2, 1])]);
    assert.equal(scorePr(r, "k2").samlet, (100 * 3 + 50 * 1) / 4);
    assert.equal(scorePr(r, "k1").samlet, (50 * 3 + 100 * 1) / 4);
  });

  test("en kategori med vægt 0 påvirker ikke den samlede score (fx Indbyggertal)", () => {
    const uden = beregnScores(kommuner(3), [kategori(1, [{ id: 1 }])], vaerdier(1, 1, [1, 2, 3]));
    const med = beregnScores(
      kommuner(3),
      [kategori(1, [{ id: 1 }]), kategori(2, [{ id: 2 }], { standardvaegt: 0 })],
      [...vaerdier(1, 1, [1, 2, 3]), ...vaerdier(2, 2, [3, 2, 1])],
    );
    for (const s of med) assert.equal(s.samlet, scorePr(uden, s.kode).samlet);
  });

  test("rapporten får de rigtige tal, også når scoren er udjævnet", () => {
    const kategorier = [
      kategori(1, [{ id: 1, navn: "Indbyggere" }], { standardvaegt: 0 }),
      kategori(2, [{ id: 2, navn: "Indbrud i beboelser pr. 1.000 indbyggere" }]),
    ];
    const r = beregnScores(kommuner(2), kategorier, [
      ...vaerdier(1, 1, [1000, 100000]),
      ...vaerdier(2, 2, [9, 3], "lavere_bedre"),
    ]);
    assert.equal(scorePr(r, "k1").vaerdier[2], 9);
  });

  test("små kommuners tal pr. indbygger trækkes mod landsniveauet", () => {
    // Tre store kommuner med 3-5 indbrud og én lille med 0. Uden udjævning ville den lille
    // få topscoren; med udjævning ender den tæt på landsniveauet og under k2.
    const kategorier = [
      kategori(1, [{ id: 1, navn: "Indbyggere" }], { standardvaegt: 0 }),
      kategori(2, [{ id: 2, navn: "Indbrud i beboelser pr. 1.000 indbyggere" }]),
    ];
    const indbrud = vaerdier(2, 2, [5, 3, 4, 0], "lavere_bedre");
    const r = beregnScores(kommuner(4), kategorier, [
      ...vaerdier(1, 1, [100000, 100000, 100000, 500]),
      ...indbrud,
    ]);
    assert.ok(scorePr(r, "k4").samlet < scorePr(r, "k2").samlet);

    // Uden indbyggertal (fx admin-panelets forhåndsvisning) springes udjævningen over.
    const udenIndbyggere = beregnScores(kommuner(4), [kategorier[1]], indbrud);
    assert.equal(scorePr(udenIndbyggere, "k4").samlet, 100);
  });

  test("tal, der ikke er pr. indbygger (fx boligpriser), udjævnes ikke", () => {
    const kategorier = [
      kategori(1, [{ id: 1, navn: "Indbyggere" }], { standardvaegt: 0 }),
      kategori(2, [{ id: 2, navn: "Parcel-/rækkehus" }]),
    ];
    const r = beregnScores(kommuner(4), kategorier, [
      ...vaerdier(1, 1, [100000, 100000, 100000, 500]),
      ...vaerdier(2, 2, [20000, 30000, 25000, 5000], "lavere_bedre"),
    ]);
    assert.equal(scorePr(r, "k4").samlet, 100);
  });
});

describe("omvendtScore", () => {
  test("bytter bund og top", () => {
    assert.equal(omvendtScore(100, 0), 50);
    assert.equal(omvendtScore(50, 0), 100);
    assert.equal(omvendtScore(100, 60), 50);
    assert.equal(omvendtScore(50, 60), 100);
  });

  test("giver det samme som at vende retningen i beregningen", () => {
    // Bruges til "Lav tæthed" på /kort: resultatet skal være det samme, som hvis lav
    // tæthed var bedst fra starten, også med venlighed.
    const tal = [12, 45, 7, 300, 88, 150, 23, 61, 9, 210];
    for (const venlighed of [0, 30, 60, 100]) {
      const kat = [kategori(1, [{ id: 1 }], { venlighed })];
      const hoej = beregnScores(kommuner(10), kat, vaerdier(1, 1, tal, "hoejere_bedre"));
      const lav = beregnScores(kommuner(10), kat, vaerdier(1, 1, tal, "lavere_bedre"));
      for (const s of hoej) {
        const forventet = scorePr(lav, s.kode).noegletal[1];
        // Scorerne er afrundet til én decimal, før de vendes.
        assert.ok(
          Math.abs(omvendtScore(s.noegletal[1], venlighed) - forventet) < 0.6,
          `${s.kode} med venlighed ${venlighed}`,
        );
      }
    }
  });
});
