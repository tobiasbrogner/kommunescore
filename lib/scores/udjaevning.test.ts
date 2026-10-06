// Tests af udjævningen af små kommuners tal pr. indbygger. Kør med: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { UDJAEVNING_INDBYGGERE, udjaevn } from "@/lib/scores/udjaevning";

const naer = (a: number, b: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} er ikke ${b}`);

test("følger formlen og trækker mod landsniveauet vægtet med indbyggertal", () => {
  const indbyggere = new Map([
    ["stor", 95000],
    ["lille", 5000],
  ]);
  const [stor, lille] = udjaevn(
    [
      { kommuneKode: "stor", vaerdi: 10 },
      { kommuneKode: "lille", vaerdi: 0 },
    ],
    indbyggere,
  );
  // Landsniveau: (95.000 × 10 + 5.000 × 0) / 100.000 = 9,5.
  const landsniveau = 9.5;
  naer(lille.vaerdi, (5000 * 0 + UDJAEVNING_INDBYGGERE * landsniveau) / (5000 + UDJAEVNING_INDBYGGERE));
  naer(stor.vaerdi, (95000 * 10 + UDJAEVNING_INDBYGGERE * landsniveau) / (95000 + UDJAEVNING_INDBYGGERE));
});

test("store kommuner er næsten uændrede, små flyttes meget", () => {
  const indbyggere = new Map([
    ["koebenhavn", 650000],
    ["laesoe", 1800],
    ["midt", 50000],
  ]);
  const r = udjaevn(
    [
      { kommuneKode: "koebenhavn", vaerdi: 20 },
      { kommuneKode: "laesoe", vaerdi: 0 },
      { kommuneKode: "midt", vaerdi: 10 },
    ],
    indbyggere,
  );
  const ny = new Map(r.map((v) => [v.kommuneKode, v.vaerdi]));
  assert.ok(Math.abs(ny.get("koebenhavn")! - 20) < 0.1);
  // Læsø beholder kun godt en fjerdedel af sit eget tal og ender tæt på landsniveauet.
  assert.ok(ny.get("laesoe")! > 10);
});

test("kommuner uden indbyggertal er uændrede", () => {
  const r = udjaevn(
    [
      { kommuneKode: "a", vaerdi: 4 },
      { kommuneKode: "ukendt", vaerdi: 0 },
    ],
    new Map([["a", 10000]]),
  );
  assert.equal(r.find((v) => v.kommuneKode === "ukendt")!.vaerdi, 0);
});

test("uden indbyggertal returneres værdierne, som de er", () => {
  const vaerdier = [{ kommuneKode: "a", vaerdi: 4 }];
  assert.deepEqual(udjaevn(vaerdier, new Map()), vaerdier);
});
