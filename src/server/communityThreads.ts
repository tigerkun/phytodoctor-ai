import { serpApiSearch, serpApiStatus } from '../lib/serpApiClient';

/**
 * Community discussion lookup (SerpApi, Feature 12) — the careGuide
 * discipline applied to the one thing this app has deliberately refused to
 * fake: "who else had this problem?" REAL threads from Reddit, real titles,
 * real links — no simulated activity, no invented upvotes. What the engine
 * returns is what renders.
 *
 *   - ONE engine call per (species, issue) pair per 7 DAYS, shared by every
 *     account — the first Keeper to ask pays, the rest read the cache.
 *   - Quota exhausted / breaker tripped / SerpApi down: serve a stale cache
 *     entry if one exists, else an honest empty answer.
 *   - Subreddit comes from the thread URL itself; upvote/comment counts are
 *     NOT extracted because organic results don't carry them reliably —
 *     rendering them would mean inventing them.
 */

const CACHE_TTL_MS = 7 * 86_400_000;
const MAX_THREADS = 5;

export interface CommunityThread {
  title: string;
  url: string;
  snippet: string;
  /** Derived from the thread URL (/r/<name>/) — null when it isn't there. */
  subreddit: string | null;
}

interface CacheRow {
  threads: CommunityThread[];
  fetchedAt: number;
}

const cache = new Map<string, CacheRow>();

export function _resetCommunityThreadsCacheForTests(): void {
  cache.clear();
}

export function communityThreadsCacheSize(): number {
  return cache.size;
}

function normalizeSpecies(species: string): string {
  return species.trim().toLowerCase().slice(0, 80);
}

function normalizeIssue(issue: string): string {
  return issue.trim().toLowerCase().slice(0, 60);
}

function subredditFromUrl(url: string): string | null {
  const m = url.match(/reddit\.com\/r\/([A-Za-z0-9_]+)/);
  return m ? `r/${m[1]}` : null;
}

function extractThreads(payload: any): CommunityThread[] {
  const organic: any[] = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  const out: CommunityThread[] = [];
  for (const r of organic) {
    const title = typeof r?.title === 'string' ? r.title.trim() : '';
    const url = typeof r?.link === 'string' ? r.link : '';
    if (!title || !/^https?:\/\//.test(url) || !url.includes('reddit.com')) continue;
    out.push({
      title: title.slice(0, 140),
      url,
      snippet: String(r?.snippet ?? '').slice(0, 260),
      subreddit: subredditFromUrl(url),
    });
    if (out.length >= MAX_THREADS) break;
  }
  return out;
}

export async function getCommunityThreads(species: string, issue: string, now: number = Date.now()): Promise<{
  threads: CommunityThread[];
  cached: boolean;
  fetchedAt: string | null;
  note: string | null;
}> {
  const sp = normalizeSpecies(species);
  if (!sp) return { threads: [], cached: false, fetchedAt: null, note: null };
  const is = normalizeIssue(issue);
  const key = `${sp}|${is}`;

  const hit = cache.get(key);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return { threads: hit.threads, cached: true, fetchedAt: new Date(hit.fetchedAt).toISOString(), note: null };
  }

  const status = serpApiStatus();
  if (!status.enabled) {
    return {
      threads: hit?.threads ?? [],
      cached: !!hit,
      fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
      note: hit ? 'Community lookup unavailable — showing the last cached threads.' : 'Community lookup is unavailable right now.',
    };
  }

  // The issue phrase is the plant's own state, phrased for a search engine.
  const query = `site:reddit.com/r/houseplants ${sp}${is ? ` ${is}` : ' care help'}`;

  const payload = await serpApiSearch('google', { q: query, num: String(MAX_THREADS + 3) });

  const threads = payload ? extractThreads(payload) : [];
  if (threads.length > 0) {
    cache.set(key, { threads, fetchedAt: now });
    return { threads, cached: false, fetchedAt: new Date(now).toISOString(), note: null };
  }

  return {
    threads: hit?.threads ?? [],
    cached: !!hit,
    fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
    note: !hit ? 'No community threads found for this species.' : null,
  };
}

export function registerCommunityThreadsRoute(app: any, middlewares: any[] = []): void {
  app.get('/api/library/community', ...middlewares, async (req: any, res: any) => {
    const species = String(req.query.species ?? '');
    if (!species.trim()) return res.status(400).json({ error: 'species query parameter is required' });
    const issue = String(req.query.issue ?? '');
    try {
      res.json({ species, ...(await getCommunityThreads(species, issue)) });
    } catch (err: any) {
      // The community section is a garnish on PlantDetail — a failure
      // degrades to empty, never a 500 that breaks the page.
      res.json({ species, threads: [], cached: false, fetchedAt: null, note: 'Community lookup failed.' });
    }
  });
}
