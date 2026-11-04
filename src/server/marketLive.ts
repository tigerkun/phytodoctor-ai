import { serpApiSearch, serpApiStatus } from '../lib/serpApiClient';

/**
 * Market live listings + trending (SerpApi) — the careGuide discipline
 * applied to the Market's honesty problem:
 *
 *   - ONE engine call per category per 7 days, shared by every account —
 *     the first Keeper to open a category pays the quota, the rest read
 *     the cache. Trending is one call per week for everyone.
 *   - Quota math: 4 shopping categories + 1 trending query per week is
 *     ~21 searches/month against the 250/month plan (Library uses ~60).
 *   - Quota exhausted / breaker tripped / SerpApi down: serve a stale
 *     cache entry if one exists, else an honest empty answer with a note.
 *     A dead SerpApi never blocks a Market render.
 *   - Only REAL fields are returned: rating and review counts appear in
 *     the payload only when SerpApi actually has them — the client never
 *     invents numbers, and the curated crates below this section carry no
 *     fake stars either.
 *
 * Price history is the previous fetch's prices, kept on the cache row:
 * when a listing was seen before at a different price, the response carries
 * previousPrice so the UI can say "was ₹X when we last looked".
 */

const CACHE_TTL_MS = 7 * 86_400_000;
const MAX_ITEMS = 8;

export interface MarketLiveItem {
  title: string;
  source: string;
  /** Display string exactly as the engine returned it ("₹1,299"). */
  priceDisplay: string | null;
  /** Numeric price when the engine parsed one — powers price history. */
  priceValue: number | null;
  /** Present ONLY when the engine has a real rating. */
  rating: number | null;
  /** Present ONLY when the engine has a real review count. */
  reviews: number | null;
  thumbnail: string | null;
  url: string | null;
  /** The price at the previous weekly fetch, when one exists. */
  previousPrice: number | null;
}

export interface TrendingPlantItem {
  title: string;
  source: string;
  url: string;
  snippet: string;
}

interface LiveCacheRow {
  items: MarketLiveItem[];
  prevPrices: Record<string, number>;
  fetchedAt: number;
}

interface TrendingCacheRow {
  items: TrendingPlantItem[];
  fetchedAt: number;
}

/** The market's own crate categories, mapped to honest shopping queries.
 *  Four categories, one call each per week — the entire quota cost. */
export const LIVE_CATEGORIES: Record<string, string> = {
  care: 'indoor plant fertilizer',
  home: 'indoor plant pots decorative',
  tools: 'houseplant pruning gardening tools',
  seeds: 'houseplant seeds succulent seeds',
};

const liveCache = new Map<string, LiveCacheRow>();
const trendingCache = new Map<string, TrendingCacheRow>();

export function _resetMarketLiveCacheForTests(): void {
  liveCache.clear();
  trendingCache.clear();
}

export function marketLiveCacheSize(): number {
  return liveCache.size + trendingCache.size;
}

function normalizeCategory(category: string): string | null {
  const key = category.trim().toLowerCase();
  return key in LIVE_CATEGORIES ? key : null;
}

function extractLiveItems(payload: any): MarketLiveItem[] {
  const raw: any[] = Array.isArray(payload?.shopping_results) ? payload.shopping_results : [];
  const items: MarketLiveItem[] = [];
  for (const r of raw) {
    const title = typeof r?.title === 'string' ? r.title.trim() : '';
    if (!title) continue;
    const priceValue = typeof r?.extracted_price === 'number' ? r.extracted_price : null;
    items.push({
      title: title.slice(0, 140),
      source: typeof r?.source === 'string' && r.source ? r.source : 'Web listing',
      priceDisplay: typeof r?.price === 'string' && r.price ? r.price : priceValue !== null ? `₹${priceValue}` : null,
      priceValue,
      rating: typeof r?.rating === 'number' && r.rating > 0 ? r.rating : null,
      reviews: typeof r?.reviews === 'number' && r.reviews > 0 ? Math.round(r.reviews) : null,
      thumbnail: typeof r?.thumbnail === 'string' && r.thumbnail ? r.thumbnail : null,
      url: typeof r?.product_link === 'string' && r.product_link
        ? r.product_link
        : typeof r?.link === 'string' && r.link
          ? r.link
          : null,
      previousPrice: null,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

function attachPriceHistory(items: MarketLiveItem[], prevPrices: Record<string, number>): void {
  for (const item of items) {
    const key = item.title.toLowerCase();
    if (item.priceValue !== null && prevPrices[key] !== undefined) {
      item.previousPrice = prevPrices[key];
    }
  }
}

function pricesOf(items: MarketLiveItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    if (item.priceValue !== null) out[item.title.toLowerCase()] = item.priceValue;
  }
  return out;
}

export async function getMarketLive(category: string, now: number = Date.now()): Promise<{
  items: MarketLiveItem[];
  cached: boolean;
  fetchedAt: string | null;
  note: string | null;
}> {
  const key = normalizeCategory(category);
  if (!key) return { items: [], cached: false, fetchedAt: null, note: 'Unknown category.' };

  const hit = liveCache.get(key);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return { items: hit.items, cached: true, fetchedAt: new Date(hit.fetchedAt).toISOString(), note: null };
  }

  const status = serpApiStatus();
  if (!status.enabled) {
    return {
      items: hit?.items ?? [],
      cached: !!hit,
      fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
      note: hit ? 'Live listings unavailable — showing the last cached fetch.' : 'Live listings are unavailable right now.',
    };
  }

  const payload = await serpApiSearch('google_shopping', {
    q: LIVE_CATEGORIES[key],
    gl: 'in',
    hl: 'en',
    num: String(MAX_ITEMS),
  });

  const items = payload ? extractLiveItems(payload) : [];
  if (items.length > 0) {
    // History is the row being replaced: what the last fetch saw.
    attachPriceHistory(items, hit?.prevPrices ?? {});
    liveCache.set(key, { items, prevPrices: pricesOf(items), fetchedAt: now });
    return { items, cached: false, fetchedAt: new Date(now).toISOString(), note: null };
  }

  // Empty result: keep any stale entry visible rather than wiping it.
  return {
    items: hit?.items ?? [],
    cached: !!hit,
    fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
    note: !hit ? 'No live listings found for this category.' : null,
  };
}

export async function getTrendingPlants(now: number = Date.now()): Promise<{
  items: TrendingPlantItem[];
  cached: boolean;
  fetchedAt: string | null;
  note: string | null;
}> {
  const key = 'weekly';
  const hit = trendingCache.get(key);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return { items: hit.items, cached: true, fetchedAt: new Date(hit.fetchedAt).toISOString(), note: null };
  }

  const status = serpApiStatus();
  if (!status.enabled) {
    return {
      items: hit?.items ?? [],
      cached: !!hit,
      fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
      note: hit ? 'Trending lookup unavailable — showing the last cached fetch.' : 'Trending lookup is unavailable right now.',
    };
  }

  const payload = await serpApiSearch('google', {
    q: 'trending houseplants this month popular indoor plants',
    gl: 'in',
    hl: 'en',
    num: '6',
  });

  const items = payload ? extractTrending(payload) : [];
  if (items.length > 0) {
    trendingCache.set(key, { items, fetchedAt: now });
    return { items, cached: false, fetchedAt: new Date(now).toISOString(), note: null };
  }
  return {
    items: hit?.items ?? [],
    cached: !!hit,
    fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
    note: !hit ? 'No trending stories found this week.' : null,
  };
}

function extractTrending(payload: any): TrendingPlantItem[] {
  const organic: any[] = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  return organic
    .slice(0, 5)
    .map(r => ({
      title: String(r?.title ?? '').slice(0, 140),
      source: String(r?.source ?? ''),
      url: String(r?.link ?? ''),
      snippet: String(r?.snippet ?? '').slice(0, 260),
    }))
    .filter(t => t.title.length > 0 && /^https?:\/\//.test(t.url));
}

export function registerMarketLiveRoute(app: any, middlewares: any[] = []): void {
  app.get('/api/market/live', ...middlewares, async (req: any, res: any) => {
    const category = String(req.query.category ?? '');
    if (!category.trim()) return res.status(400).json({ error: 'category query parameter is required' });
    try {
      res.json({ category, ...(await getMarketLive(category)) });
    } catch (err: any) {
      // The live store is a garnish on the Market — a failure degrades to
      // empty with a note, never a 500 that breaks the page.
      res.json({ category, items: [], cached: false, fetchedAt: null, note: 'Live listing lookup failed.' });
    }
  });

  app.get('/api/market/trending', ...middlewares, async (_req: any, res: any) => {
    try {
      res.json(await getTrendingPlants());
    } catch (err: any) {
      res.json({ items: [], cached: false, fetchedAt: null, note: 'Trending lookup failed.' });
    }
  });
}
