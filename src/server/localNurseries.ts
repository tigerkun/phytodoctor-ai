import { serpApiSearch, serpApiStatus } from '../lib/serpApiClient';

/**
 * Local nursery finder (SerpApi google engine) — the careGuide discipline,
 * query-shaped instead of species-shaped:
 *
 *   - ONE engine call per normalized query per 7 DAYS, shared by every
 *     account — "plant nursery Pune" is the same question from every
 *     Keeper who types it.
 *   - NO geolocation plumbing: the query is text. The client prefills from
 *     the city it already holds (botanical_city) and asks for one otherwise;
 *     this route never silently prompts for location.
 *   - Only fields the engine actually returns — organic results carry
 *     address/phone/rating inconsistently, so each is null when absent.
 *   - Quota exhausted / breaker tripped / SerpApi down: stale-over-nothing.
 */

const CACHE_TTL_MS = 7 * 86_400_000;
const MAX_RESULTS = 6;

export interface Nursery {
  name: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  hours: string | null;
  website: string | null;
  thumbnail: string | null;
}

interface CacheRow {
  nurseries: Nursery[];
  fetchedAt: number;
}

const cache = new Map<string, CacheRow>();

export function _resetLocalNurseriesCacheForTests(): void {
  cache.clear();
}

export function localNurseriesCacheSize(): number {
  return cache.size;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().slice(0, 100);
}

function extractNurseries(payload: any): Nursery[] {
  const organic: any[] = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  const out: Nursery[] = [];
  for (const r of organic) {
    const name = typeof r?.title === 'string' ? r.title.trim() : '';
    const website = typeof r?.link === 'string' && /^https?:\/\//.test(r.link) ? r.link : null;
    if (!name) continue;
    out.push({
      name: name.slice(0, 120),
      address: typeof r?.address === 'string' && r.address ? r.address.slice(0, 160) : null,
      phone: typeof r?.phone === 'string' && r.phone ? r.phone.slice(0, 30) : null,
      rating: typeof r?.rating === 'number' && r.rating > 0 ? r.rating : null,
      hours: typeof r?.hours === 'string' && r.hours ? r.hours.slice(0, 60) : null,
      website,
      thumbnail: typeof r?.thumbnail === 'string' && r.thumbnail ? r.thumbnail : null,
    });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

export async function getLocalNurseries(query: string, now: number = Date.now()): Promise<{
  nurseries: Nursery[];
  cached: boolean;
  fetchedAt: string | null;
  note: string | null;
}> {
  const key = normalizeQuery(query);
  if (!key) return { nurseries: [], cached: false, fetchedAt: null, note: null };

  const hit = cache.get(key);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return { nurseries: hit.nurseries, cached: true, fetchedAt: new Date(hit.fetchedAt).toISOString(), note: null };
  }

  const status = serpApiStatus();
  if (!status.enabled) {
    return {
      nurseries: hit?.nurseries ?? [],
      cached: !!hit,
      fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
      note: hit ? 'Nursery lookup unavailable — showing the last cached results.' : 'Nursery lookup is unavailable right now.',
    };
  }

  const payload = await serpApiSearch('google', {
    q: `plant nursery ${key}`,
    num: String(MAX_RESULTS + 3),
    gl: 'in',
    hl: 'en',
  });

  const nurseries = payload ? extractNurseries(payload) : [];
  if (nurseries.length > 0) {
    cache.set(key, { nurseries, fetchedAt: now });
    return { nurseries, cached: false, fetchedAt: new Date(now).toISOString(), note: null };
  }

  // Stale-over-empty: a transient blank must not poison the key for a week.
  return {
    nurseries: hit?.nurseries ?? [],
    cached: !!hit,
    fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
    note: !hit ? 'No nurseries found for that search — try a city or area name.' : null,
  };
}

export function registerLocalNurseriesRoute(app: any): void {
  app.get('/api/market/nurseries', async (req: any, res: any) => {
    const query = String(req.query.q ?? '');
    if (!query.trim()) return res.status(400).json({ error: 'q query parameter is required' });
    try {
      res.json({ query, ...(await getLocalNurseries(query)) });
    } catch (err: any) {
      // The nursery section is a garnish on the Market — degrade to empty
      // with the reason in the response, never a 500 that breaks the page.
      res.json({ query, nurseries: [], cached: false, fetchedAt: null, note: 'Nursery lookup failed.' });
    }
  });
}
