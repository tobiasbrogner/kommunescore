import "server-only";

// Simpel in-memory rate limiter pr. IP til login-routen. Nulstilles ved
// serverrestart og virker kun korrekt med én kørende instans — det er en
// bevidst afvejning, siden panelet kun har én administrator. Vokser
// belastningen (flere instanser/serverless), skal dette erstattes af en
// delt limiter (fx Redis).
const FORSOEG_GRAENSE = 5;
const VINDUE_MS = 15 * 60 * 1000; // 15 minutter

const forsoeg = new Map<string, { count: number; nulstillesVed: number }>();

export function erRateLimited(ip: string): boolean {
  const nu = Date.now();
  const post = forsoeg.get(ip);

  if (!post || post.nulstillesVed < nu) {
    forsoeg.set(ip, { count: 1, nulstillesVed: nu + VINDUE_MS });
    return false;
  }

  post.count += 1;
  return post.count > FORSOEG_GRAENSE;
}
