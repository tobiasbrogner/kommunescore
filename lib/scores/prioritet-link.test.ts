// Tests af Prioritet i delte links (/kort?vaegt=...). Kør med: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  prioritetFraParametre,
  prioritetTilParametre,
  standardPrioritet,
  type GemtPrioritet,
} from "@/lib/scores/prioritet-link";

test("en prioritet kommer uændret tilbage fra linket", () => {
  const p: GemtPrioritet = {
    vaegte: { boligpriser: 80, boern: 0 },
    fra: ["natur", "idraet"],
    noegletal: { boligpriser: ["hus"], indbyggertal: ["antal", "taethed"] },
  };
  const params = prioritetTilParametre(p);
  assert.equal(params.get("vaegt"), "boligpriser.80_boern.0");
  assert.deepEqual(prioritetFraParametre(new URLSearchParams(params.toString())), p);
});

test("et link uden Prioritet giver null", () => {
  assert.equal(prioritetFraParametre(new URLSearchParams("kommune=aarhus")), null);
});

test("ugyldige vægte springes over", () => {
  const p = prioritetFraParametre(new URLSearchParams("vaegt=natur.150_skat.abc_boern.40_.5_tryghed"));
  assert.deepEqual(p?.vaegte, { boern: 40 });
});

test("standardvægten fra databasen bliver til 0-100", () => {
  assert.equal(standardPrioritet(1), 50);
  assert.equal(standardPrioritet(0), 0);
  assert.equal(standardPrioritet(0.5), 25);
  assert.equal(standardPrioritet(3), 100);
});
