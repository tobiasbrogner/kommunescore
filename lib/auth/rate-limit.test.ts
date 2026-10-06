// Tests af grænserne for login, feedback og chat. Kør med: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { chatKvoteGaest, erLoginLoftNaaet, erRateLimited } from "@/lib/auth/rate-limit";

test("login: 5 forsøg pr. IP, så spærres der", () => {
  const svar = Array.from({ length: 7 }, () => erRateLimited("test-ip-a"));
  assert.deepEqual(svar, [false, false, false, false, false, true, true]);
  // En anden IP har sin egen grænse.
  assert.equal(erRateLimited("test-ip-b"), false);
});

test("login: det samlede loft gælder på tværs af alle IP'er", () => {
  const svar = Array.from({ length: 31 }, () => erLoginLoftNaaet("alle"));
  assert.equal(svar.slice(0, 30).every((spaerret) => !spaerret), true);
  assert.equal(svar[30], true);
});

test("chat: kvoten tælles ned og kan ikke bruges, når den er opbrugt", () => {
  assert.equal(chatKvoteGaest.tilbage("test-chat"), chatKvoteGaest.graense);
  for (let i = 0; i < chatKvoteGaest.graense; i++) assert.equal(chatKvoteGaest.brug("test-chat"), true);
  assert.equal(chatKvoteGaest.tilbage("test-chat"), 0);
  assert.equal(chatKvoteGaest.brug("test-chat"), false);
});

test("oprydningen ved mange IP'er bevarer tællerne for de nyeste", () => {
  // 60.000 falske IP'er udløser oprydningen (højst 50.000 poster; de ældste fjernes).
  for (let i = 0; i < 60_000; i++) erRateLimited(`falsk-${i}`);
  // Den nyeste IP har stadig sin tæller: 1 forsøg før, så dette er nr. 2 af 5.
  assert.equal(erRateLimited("falsk-59999"), false);
  for (let i = 0; i < 3; i++) erRateLimited("falsk-59999");
  assert.equal(erRateLimited("falsk-59999"), true);
});
