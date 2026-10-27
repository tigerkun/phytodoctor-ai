/**
 * LIBRARY DAILY SERVICE
 *
 * Frontend bridge to the server's lazy-calendar cached Library batch
 * (`GET /api/library/daily`). One request per Library visit — the server
 * makes at most 2 SerpApi engine calls per calendar day (1 News + 1 Q&A) and
 * serves every other visitor from cache, so quota is never the client's
 * problem to manage.
 *
 * Fallback contract: a null quiz array tells Library.tsx to use the static
 * bank; an empty news array tells the carousel to show its built-in card.
 */

export interface DailyQuizItem {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface EnvironmentalNewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
  snippet?: string;
  thumbnail?: string;
}

export interface LibraryDailyPayload {
  dayKey: string;
  /** Shaped dynamic quizzes (up to 3) — null means "use the static bank". */
  quiz: DailyQuizItem[] | null;
  /** Weekly theme the server's Q&A engine call ran on (display only). */
  quizTheme: string;
  /** Top 10 environmental news, possibly stale from a previous cache day. */
  news: EnvironmentalNewsItem[];
  /** True when news came from an older cache day (SerpApi unavailable today). */
  newsStale: boolean;
  meta: {
    serpApi: { enabled: boolean; searchesUsed: number; monthlyLimit: number; disabledReason: string | null };
    generatedAt: string;
  };
}

const REQUEST_TIMEOUT_MS = 20_000;

export async function fetchLibraryDaily(): Promise<LibraryDailyPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch('/api/library/daily', {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('botanical_guardian_auth_token') || ''}`,
      },
    });
    if (!response.ok) throw new Error(`Library daily HTTP ${response.status}`);
    return (await response.json()) as LibraryDailyPayload;
  } finally {
    clearTimeout(timeout);
  }
}
