// Tests af klientIp: den sidste adresse i X-Forwarded-For bruges. Kør med: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { klientIp } from "@/lib/klient-ip";

const med = (xff?: string) =>
  new Request("http://localhost/", { headers: xff === undefined ? {} : { "x-forwarded-for": xff } });

test("bruger adressen, som proxyen har tilføjet bagerst", () => {
  assert.equal(klientIp(med("203.0.113.7")), "203.0.113.7");
  // En falsk adresse foran, som den besøgende selv har skrevet, ignoreres.
  assert.equal(klientIp(med("1.2.3.4, 203.0.113.7")), "203.0.113.7");
  assert.equal(klientIp(med(" 9.9.9.9 ,1.2.3.4,  203.0.113.7 ")), "203.0.113.7");
});

test("uden headeren gives en fast nøgle", () => {
  assert.equal(klientIp(med()), "ukendt");
  assert.equal(klientIp(med("")), "ukendt");
});
