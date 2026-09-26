import "server-only";

// Simpel in-memory rate limiter pr. IP. Nulstilles ved serverrestart og
// virker kun korrekt med én kørende instans — det er en bevidst afvejning,
// siden sitet kører som én instans. Vokser belastningen (flere
// instanser/serverless), skal dette erstattes af en delt limiter (fx Redis).
function opretRateLimiter(graense: number, vindueMs: number) {
  const forsoeg = new Map<string, { count: number; nulstillesVed: number }>();

  return function erRateLimited(ip: string): boolean {
    const nu = Date.now();
    const post = forsoeg.get(ip);

    if (!post || post.nulstillesVed < nu) {
      forsoeg.set(ip, { count: 1, nulstillesVed: nu + vindueMs });
      return false;
    }

    post.count += 1;
    return post.count > graense;
  };
}

// Login: 5 forsøg pr. 15 minutter.
export const erRateLimited = opretRateLimiter(5, 15 * 60 * 1000);

// Feedback: 5 indsendelser pr. 10 minutter — nok til ærlig brug, dæmper spam.
export const erFeedbackRateLimited = opretRateLimiter(5, 10 * 60 * 1000);
