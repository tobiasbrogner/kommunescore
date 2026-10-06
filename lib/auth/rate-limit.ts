import "server-only";

// Simpel in-memory rate limiter pr. IP. Nulstilles ved serverrestart og
// virker kun korrekt med én kørende instans — det er en bevidst afvejning,
// siden sitet kører som én instans. Vokser belastningen (flere
// instanser/serverless), skal dette erstattes af en delt limiter (fx Redis).
// IP'en findes med klientIp (lib/klient-ip.ts), som ikke kan forfalskes bag en proxy.

type Post = { count: number; nulstillesVed: number };

// Udløbne poster fjernes med jævne mellemrum, så tabellen ikke vokser for hver ny IP.
// Bliver den alligevel meget stor (mange forskellige IP'er på kort tid), fjernes de
// ældste, så hukommelsen holdes nede.
const OPRYD_HVER = 1000;
const MAKS_POSTER = 50_000;

function opretTabel() {
  const poster = new Map<string, Post>();
  let kaldSidenOprydning = 0;

  return {
    poster,
    ryd() {
      if (++kaldSidenOprydning < OPRYD_HVER && poster.size < MAKS_POSTER) return;
      kaldSidenOprydning = 0;
      const nu = Date.now();
      for (const [noegle, post] of poster) if (post.nulstillesVed < nu) poster.delete(noegle);
      for (const noegle of poster.keys()) {
        if (poster.size < MAKS_POSTER) break;
        poster.delete(noegle);
      }
    },
  };
}

function opretRateLimiter(graense: number, vindueMs: number) {
  const { poster: forsoeg, ryd } = opretTabel();

  return function erRateLimited(ip: string): boolean {
    ryd();
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

// Login: 5 forsøg pr. 15 minutter pr. IP, og højst 30 i alt fra alle IP'er. Det samlede
// loft beskytter adgangskoden, selv hvis nogen har mange IP'er; prisen er, at login kan
// være spærret i op til 15 minutter under et angreb.
export const erRateLimited = opretRateLimiter(5, 15 * 60 * 1000);
export const erLoginLoftNaaet = opretRateLimiter(30, 15 * 60 * 1000);

// Feedback: 5 indsendelser pr. 10 minutter — nok til ærlig brug, dæmper spam.
// Samlet højst 100 i timen, så spam fra mange IP'er ikke fylder databasen.
export const erFeedbackRateLimited = opretRateLimiter(5, 10 * 60 * 1000);
export const erFeedbackLoftNaaet = opretRateLimiter(100, 60 * 60 * 1000);

// Adressesøgning: 60 opslag pr. minut. Feltet søger, mens man skriver, men skåner den
// gratis adressetjeneste, vi slår op i.
export const erAdresseRateLimited = opretRateLimiter(60, 60 * 1000);

// Som opretRateLimiter, men man kan også se, hvor meget der er tilbage uden at bruge
// af det, så brugeren kan få vist sin resterende kvote.
function opretKvote(graense: number, vindueMs: number) {
  const { poster: brugt, ryd } = opretTabel();

  const aktuel = (noegle: string) => {
    const post = brugt.get(noegle);
    return post && post.nulstillesVed >= Date.now() ? post : null;
  };

  return {
    graense,
    tilbage: (noegle: string) => Math.max(0, graense - (aktuel(noegle)?.count ?? 0)),
    // Bruger én af kvoten; false, hvis den allerede er opbrugt.
    brug(noegle: string): boolean {
      ryd();
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

// AI-chat: hvert kald koster penge, så der er både en kvote pr. besøgende og et samlet
// loft for hele sitet pr. døgn (kaldes med en fast nøgle). Den hårde grænse for
// udgiften er beløbsgrænsen i Anthropic Console; disse holder den fordelt.
// Besøgende uden login tælles pr. IP; indloggede pr. konto med en større kvote.
export const chatKvoteGaest = opretKvote(5, 24 * 60 * 60 * 1000);
export const chatKvoteBruger = opretKvote(10, 24 * 60 * 60 * 1000);
export const erChatLoftNaaet = opretRateLimiter(500, 24 * 60 * 60 * 1000);
