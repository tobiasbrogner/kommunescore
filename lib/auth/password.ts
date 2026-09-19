import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 eksporterer Algorithm som en `const enum`, som ikke kan
// importeres når TypeScripts "isolatedModules" er slået til (som i denne
// Next.js-opsætning) — 2 er den numeriske værdi for Argon2id i biblioteket.
const ARGON2ID = 2;

// OWASP-anbefalede minimumsparametre for Argon2id ("second recommended option",
// til miljøer med begrænset hukommelse). Ét sted, så seed-scriptet og login
// altid bruger nøjagtig samme parametre.
const ARGON2ID_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2ID_OPTIONS);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return verify(hash, password, ARGON2ID_OPTIONS);
}

// En fast, gyldig Argon2id-hash af en tilfældig, ukendt værdi. Bruges til at
// køre en hash-verify selv når en e-mail ikke findes i databasen, så login-
// routen ikke afslører (via svartid) om det var e-mailen eller kodeordet der
// var forkert.
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$LK0s3Yy4BdXDzJ85RYcQVw$sKynsx0G//a9SBX5NtWW3m28bE8eH4pGPWBMaY6kaRI";
