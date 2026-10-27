/**
 * LIBRARY DAILY API
 *
 * One route powers the Library's daily content: the Q&A quiz set and the
 * Top 10 environmental news carousel.
 *
 * ── LAZY CALENDAR CACHE ──────────────────────────────────────────────────
 * The daily content must be identical for every visitor on the same day
 * (streaks, featured draws, and the daily ladder all depend on a stable
 * answer key), and it must NOT burn SerpApi quota on every visit. So the
 * batch is computed once per calendar day and memoised in-process:
 *
 *   - First request after a new day rolls the engine calls (max 2: 1 google
 *     for the Q&A theme, 1 google_news for the headlines), shapes them with
 *     Gemini, and stores the result keyed by the calendar day.
 *   - Every later request that day replays the cached payload instantly --
 *     no SerpApi call, no Gemini call, no recomputation.
 *   - When SerpApi is disabled / out of quota / breaker-tripped, the cached
 *     payload from a previous day is served with `newsStale: true` and
 *     `quiz: null`; the client falls back to its static bank and the built-in
 *     fallback card. A broken SerpApi never blocks a Library render.
 *
 * Quota math: 2 calls/day x 31 days = 62/month against the 250 free plan
 * ceiling -- 188 searches of headroom.
 */

import {
  WEEKLY_QUIZ_THEMES,
  extractRelatedQuestions,
  extractEnvironmentalNews,
  serpApiSearch,
  serpApiStatus,
} from '../lib/serpApiClient';

// Dependency injection: the monolithic server.ts owns the Gemini client and
// the structured logger, so they are passed in rather than imported to avoid
// a circular dependency.
export interface LibraryDailyDeps {
  aiFast: any;
  log: any;
  generateWithRetry?: any;
}

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
  quiz: DailyQuizItem[] | null;
  quizTheme: string;
  news: EnvironmentalNewsItem[];
  newsStale: boolean;
  meta: {
    serpApi: { enabled: boolean; searchesUsed: number; monthlyLimit: number; disabledReason: string | null };
    generatedAt: string;
  };
}

const QUIZZES_PER_DAY = 3;

function dayKeyOf(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weeklyThemeIndex(d: Date = new Date()): number {
  // Monday=0 ... Sunday=6 (getDay: Sunday=0 ... Saturday=6)
  return (d.getDay() + 6) % 7;
}

// ── In-process cache & single-flight inflight promise ─────────────────────
let cache: { dayKey: string; payload: LibraryDailyPayload } | null = null;
let inflight: Promise<LibraryDailyPayload> | null = null;

export function _resetLibraryDailyCacheForTests(): void {
  cache = null;
  inflight = null;
}

function serveCached(stale: boolean): LibraryDailyPayload {
  if (!cache) return emptyPayload(stale);
  return stale ? { ...cache.payload, newsStale: true, quiz: null } : cache.payload;
}

function emptyPayload(stale: boolean): LibraryDailyPayload {
  return {
    dayKey: dayKeyOf(),
    quiz: null,
    quizTheme: WEEKLY_QUIZ_THEMES[weeklyThemeIndex()],
    news: [],
    newsStale: stale,
    meta: { serpApi: serpApiStatus(), generatedAt: new Date().toISOString() },
  };
}

/**
 * Shape raw SerpApi related questions into quiz items with plausible
 * distractors. Gemini writes the wrong options; the fetched snippet grounds
 * the correct one so the answer key is always defensible.
 */
async function shapeQuizzesWithGemini(
  rawQuestions: { question: string; snippet: string }[],
  deps: LibraryDailyDeps,
): Promise<DailyQuizItem[]> {
  if (rawQuestions.length === 0) return [];
  const { aiFast, generateWithRetry } = deps;

  const promptText = [
    'You are building a botanical quiz from real search-engine questions.',
    'For each question below, return a JSON array of objects with fields:',
    '- "question": the question, lightly rewritten for clarity (keep the botanical fact intact).',
    '- "answer": a short phrase (max 8 words) that the provided snippet clearly supports.',
    '- "distractors": exactly two short phrases (max 8 words each) that are plausible but wrong.',
    '- "explanation": one sentence (max 160 chars) explaining the correct answer, grounded in the snippet.',
    'Return ONLY the JSON array. No markdown fences.',
    '',
    'QUESTIONS:',
    ...rawQuestions.map((q, i) => `${i + 1}. ${q.question}\n   SNIPPET: ${q.snippet}`),
  ].join('\n');

  let text = '';
  if (generateWithRetry) {
    const response = await generateWithRetry({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: {
        responseMimeType: 'application/json',
        disableThinking: true,
      },
    });
    text = response?.text ?? '';
  } else if (aiFast) {
    const response = await aiFast.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: {
        responseMimeType: 'application/json',
        disableThinking: true,
      },
    });
    text = response?.text ?? '';
  }

  const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed)) throw new Error('Gemini quiz shaping returned non-array');

  const items: DailyQuizItem[] = [];
  for (const entry of parsed.slice(0, QUIZZES_PER_DAY)) {
    const question = typeof entry?.question === 'string' ? entry.question.trim() : '';
    const answer = typeof entry?.answer === 'string' ? entry.answer.trim() : '';
    const distractors = Array.isArray(entry?.distractors) ? entry.distractors : [];
    const explanation = typeof entry?.explanation === 'string' ? entry.explanation.trim() : '';
    const wrong = distractors.map((d: any) => String(d).trim()).filter(Boolean).slice(0, 2);
    if (!question || !answer || wrong.length < 2 || !explanation) continue;

    // The correct answer's position is decided server-side so the client can
    // shuffle options freely without ever needing to know the answer key.
    const options = [answer, ...wrong];
    const answerIndex = 0;
    items.push({ question, options, answer: answerIndex, explanation });
  }
  return items;
}

export async function getLibraryDaily(deps: LibraryDailyDeps): Promise<LibraryDailyPayload> {
  const today = dayKeyOf();
  if (cache && cache.dayKey === today) {
    return cache.payload;
  }
  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const fresh = await computeDaily(today, deps);
      cache = { dayKey: today, payload: fresh };
      return fresh;
    } catch (err) {
      if (cache) {
        deps.log?.warn?.('Library daily refresh failed; serving previous day as stale', { err });
        return { ...cache.payload, newsStale: true, quiz: null, dayKey: today };
      }
      return emptyPayload(false);
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

async function computeDaily(today: string, deps: LibraryDailyDeps): Promise<LibraryDailyPayload> {
  const themeIndex = weeklyThemeIndex();
  const quizTheme = WEEKLY_QUIZ_THEMES[themeIndex];
  const themeQuery = `${quizTheme} people also ask`;

  // ── Engine call 1: google (Q&A theme) ───────────────────────────────────
  const searchPayload = await serpApiSearch('google', {
    q: themeQuery,
    num: '10',
  });
  const rawQuestions = searchPayload ? extractRelatedQuestions(searchPayload, 4) : [];

  // ── Engine call 2: google_news (environmental headlines) ────────────────
  const newsPayload = await serpApiSearch('google_news', {
    q: 'environment botany plants conservation climate',
    gl: 'us',
    hl: 'en',
    num: '10',
  });
  const news = newsPayload ? extractEnvironmentalNews(newsPayload, 10) : [];

  // ── Gemini shaping (only when the Q&A engine returned something) ────────
  let quiz: DailyQuizItem[] | null = null;
  if (rawQuestions.length > 0) {
    try {
      quiz = await shapeQuizzesWithGemini(rawQuestions, deps);
    } catch (err) {
      deps.log.warn('Gemini quiz shaping failed; static bank will serve today', { err });
      quiz = null;
    }
  }

  const status = serpApiStatus();
  return {
    dayKey: today,
    quiz,
    quizTheme,
    news,
    newsStale: false,
    meta: { serpApi: status, generatedAt: new Date().toISOString() },
  };
}

// ── Express route wiring ────────────────────────────────────────────────────
export function registerLibraryDailyRoute(app: any, deps: LibraryDailyDeps, middlewares: any[] = []): void {
  app.get('/api/library/daily', ...middlewares, async (_req: any, res: any) => {
    try {
      const payload = await getLibraryDaily(deps);
      res.json(payload);
    } catch (err) {
      deps.log?.error?.('Library daily route failed', { err });
      res.status(500).json({ error: 'Library daily content unavailable' });
    }
  });
}
