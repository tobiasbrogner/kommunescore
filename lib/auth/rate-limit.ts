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

// Som opretRateLimiter, men man kan også se, hvor meget der er tilbage uden at bruge
// af det, så brugeren kan få vist sin resterende kvote.
function opretKvote(graense: number, vindueMs: number) {
  const brugt = new Map<string, { count: number; nulstillesVed: number }>();

  const aktuel = (noegle: string) => {
    const post = brugt.get(noegle);
    return post && post.nulstillesVed >= Date.now() ? post : null;
  };

  return {
    graense,
    tilbage: (noegle: string) => Math.max(0, graense - (aktuel(noegle)?.count ?? 0)),
    // Bruger én af kvoten; false, hvis den allerede er opbrugt.
    brug(noegle: string): boolean {
      const post = aktuel(noegle);
      if (!post) {
        brugt.set(noegle, { count: 1, nulstillesVed: Date.now() + vindueMs });
        return true;
      }
      if (post.count >= graense) return false;
      post.count += 1;
      return true;
    },
  };
}

// AI-chat: hvert kald koster penge, så der er både en kvote pr. IP og et samlet
// loft for hele sitet pr. døgn (kaldes med en fast nøgle). Den hårde grænse for
// udgiften er beløbsgrænsen i Anthropic Console; disse holder den fordelt.
export const chatKvote = opretKvote(10, 24 * 60 * 60 * 1000);
export const erChatLoftNaaet = opretRateLimiter(500, 24 * 60 * 60 * 1000);
