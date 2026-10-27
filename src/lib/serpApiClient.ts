/**
 * SERPAPI CLIENT — Daily Library Engine
 *
 * Bridges the Library feature to SerpApi (https://serpapi.com) for two
 * server-side features, each consuming exactly ONE engine call per day:
 *
 *   1. Daily Q&A  -- google search for "people also ask" questions on a
 *      rotating weekly botanical theme, verified + given plausible distractors
 *      by Gemini, then shaped into the DailyQuiz schema.
 *   2. Top 10 News -- google_news engine for environmental / botany headlines.
 *
 * BUDGET. The free plan is 250 searches/month. The lazy calendar cache in
 * server.ts means a day of traffic costs at most 2 calls regardless of
 * visitor count. The user's tuning decision: keep a lower safety parameter so
 * more of the budget stays available for other things -- so the client tracks
 * a hard monthly ceiling of 250 and the daily orchestration caps at 2/day
 * (60/month, ~190 headroom). If the ledger ever approaches the ceiling the
 * circuit breaker suspends the service for the process lifetime.
 *
 * CIRCUIT BREAKER. A quota rejection (429/401) or 3 consecutive transport
 * failures suspends SerpApi for the process. Callers degrade to yesterday's
 * cache or the static bank -- a dead SerpApi never blocks a Library render.
 *
 * Server-only by convention: the API key comes from process.env and must
 * never reach the client bundle.
 */

const SERPAPI_BASE = 'https://serpapi.com';

export interface SerpApiRelatedQuestion {
  question: string;
  snippet: string;
  title?: string;
  link?: string;
}

export interface SerpApiNewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
  snippet?: string;
  thumbnail?: string;
}

/** Rotating weekly theme for the Daily Q&A engine call (Mon-Sun). */
export const WEEKLY_QUIZ_THEMES: string[] = [
  'houseplant diseases diagnosis treatment',        // Monday
  'soil health aeration repotting substrate',       // Tuesday
  'plant pests spider mites mealybugs thrips',      // Wednesday
  'hydroponics aeroponics indoor growing',          // Thursday
  'succulent cacti care watering sunlight',         // Friday
  'plant propagation cuttings seedlings grafting',  // Saturday
  'botanical history rare species conservation',    // Sunday
];

/** Hard ceiling matching the free plan: 250 searches/month. */
const MONTHLY_SEARCH_LIMIT = 250;
/** Transport failures before the breaker trips (mirrors imaggaClient). */
const MAX_CONSECUTIVE_FAILURES = 3;
const REQUEST_TIMEOUT_MS = 15_000;

// ── Quota ledger + circuit breaker (process-lifetime, like imaggaClient) ───
let searchesUsed = 0;
let consecutiveFailures = 0;
let disabledReason: string | null = null;

export function _resetSerpApiStateForTests(): void {
  searchesUsed = 0;
  consecutiveFailures = 0;
  disabledReason = null;
}

export function serpApiEnabled(): boolean {
  if (!process.env.SERPAPI_API_KEY?.trim()) return false;
  return disabledReason === null;
}

export function serpApiStatus(): {
  enabled: boolean;
  searchesUsed: number;
  monthlyLimit: number;
  disabledReason: string | null;
} {
  return {
    enabled: serpApiEnabled(),
    searchesUsed,
    monthlyLimit: MONTHLY_SEARCH_LIMIT,
    disabledReason,
  };
}

function tripBreaker(reason: string): void {
  disabledReason = reason;
}

async function serpApiFetch(params: Record<string, string>): Promise<any> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) throw new Error('SerpApi credentials missing');

  const url = `${SERPAPI_BASE}/search.json?${new URLSearchParams({ ...params, api_key: apiKey })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  if (res.status === 401) {
    throw Object.assign(new Error('SerpApi rejected the API key (HTTP 401)'), { quotaExhausted: true });
  }
  if (res.status === 429) {
    throw Object.assign(new Error('SerpApi quota rejected the request (HTTP 429)'), { quotaExhausted: true });
  }
  if (!res.ok) {
    throw new Error(`SerpApi HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Make a metered SerpApi engine call. One search consumes one of the 250
 * monthly searches. Returns null (never throws) on any failure.
 */
export async function serpApiSearch(
  engine: 'google' | 'google_news',
  params: Record<string, string>,
): Promise<any | null> {
  if (!serpApiEnabled()) return null;
  if (searchesUsed >= MONTHLY_SEARCH_LIMIT) {
    tripBreaker(`monthly ledger reached the ${MONTHLY_SEARCH_LIMIT}-search plan limit`);
    return null;
  }

  try {
    const payload = await serpApiFetch({ engine, ...params });
    searchesUsed += 1;
    consecutiveFailures = 0;
    return payload;
  } catch (err: any) {
    consecutiveFailures += 1;
    if (err?.quotaExhausted) {
      tripBreaker('quota exhausted (billing-cycle limit reached)');
    } else if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      tripBreaker(`${consecutiveFailures} consecutive failures, last: ${err?.message ?? err}`);
    }
    return null;
  }
}

/**
 * Extract up to `limit` question-like entries from a Google SERP's
 * related_questions block. Filters entries missing the snippet -- those can't
 * seed a defensible quiz question.
 */
export function extractRelatedQuestions(
  payload: any,
  limit = 4,
): SerpApiRelatedQuestion[] {
  const raw: any[] = Array.isArray(payload?.related_questions)
    ? payload.related_questions
    : Array.isArray(payload?.questions)
      ? payload.questions
      : [];
  return raw
    .filter((q) => typeof q?.question === 'string' && q.question.length > 0 && typeof q?.snippet === 'string' && q.snippet.length > 0)
    .slice(0, limit)
    .map((q) => ({
      question: String(q.question),
      snippet: String(q.snippet),
      title: q.title ? String(q.title) : undefined,
      link: q.link ? String(q.link) : undefined,
    }));
}

/**
 * Extract up to `limit` environmental news articles from a google_news
 * response, normalising SerpApi's nested shape into the carousel contract.
 */
export function extractEnvironmentalNews(payload: any, limit = 10): SerpApiNewsItem[] {
  const raw: any[] = Array.isArray(payload?.news_results)
    ? payload.news_results
    : Array.isArray(payload?.news)
      ? payload.news
      : [];
  const items: SerpApiNewsItem[] = [];
  for (const entry of raw) {
    const item = entry?.story ?? entry;
    const title = typeof item?.title === 'string' ? item.title : '';
    const link = typeof item?.link === 'string' ? item.link : '';
    if (!title || !link) continue;
    items.push({
      title,
      link,
      source: typeof item?.source?.name === 'string' ? item.source.name : 'News',
      date: typeof item?.date === 'string' ? item.date : 'Recent',
      snippet: typeof item?.snippet === 'string' ? item.snippet : undefined,
      thumbnail: typeof item?.thumbnail === 'string' ? item.thumbnail : undefined,
    });
    if (items.length >= limit) break;
  }
  return items;
}
