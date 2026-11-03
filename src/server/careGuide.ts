import { serpApiSearch, serpApiStatus } from '../lib/serpApiClient';

/**
 * Species care guides (SerpApi, Feature 8) — the libraryDaily discipline
 * applied to a second surface:
 *
 *   - ONE engine call per species per 7 days, shared by every account —
 *     the first Keeper to ask pays the quota, the rest read the cache.
 *   - Quota exhausted / breaker tripped / SerpApi down: serve a stale cache
 *     entry if one exists, else an honest empty answer. A broken SerpApi
 *     never blocks a PlantDetail render.
 *   - Organic results only — no shopping, no ads.
 */

const CACHE_TTL_MS = 7 * 86_400_000;

export interface CareGuideEntry {
  title: string;
  source: string;
  url: string;
  summary: string;
}

interface CacheRow {
  guides: CareGuideEntry[];
  fetchedAt: number;
}

const cache = new Map<string, CacheRow>();

export function _resetCareGuideCacheForTests(): void {
  cache.clear();
}

export function careGuideCacheSize(): number {
  return cache.size;
}

function normalizeSpecies(species: string): string {
  return species.trim().toLowerCase().slice(0, 80);
}

function extractGuides(payload: any): CareGuideEntry[] {
  const organic: any[] = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  return organic
    .slice(0, 6)
    .map(r => ({
      title: String(r?.title ?? '').slice(0, 140),
      source: String(r?.source ?? ''),
      url: String(r?.link ?? ''),
      summary: String(r?.snippet ?? '').slice(0, 320),
    }))
    .filter(g => g.title.length > 0 && /^https?:\/\//.test(g.url));
}

export async function getCareGuide(species: string, now: number = Date.now()): Promise<{
  guides: CareGuideEntry[];
  cached: boolean;
  fetchedAt: string | null;
  note: string | null;
}> {
  const key = normalizeSpecies(species);
  if (!key) return { guides: [], cached: false, fetchedAt: null, note: null };

  const hit = cache.get(key);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return { guides: hit.guides, cached: true, fetchedAt: new Date(hit.fetchedAt).toISOString(), note: null };
  }

  const status = serpApiStatus();
  if (!status.enabled) {
    // No key or breaker tripped: stale-over-nothing.
    return {
      guides: hit?.guides ?? [],
      cached: !!hit,
      fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
      note: hit ? 'Live lookup unavailable — showing the last cached guide.' : 'Live care-guide lookup is unavailable right now.',
    };
  }

  const payload = await serpApiSearch('google', {
    q: `how to care for ${key} houseplant watering light soil`,
    num: '6',
  });

  const guides = payload ? extractGuides(payload) : [];
  if (guides.length > 0) {
    cache.set(key, { guides, fetchedAt: now });
    return { guides, cached: false, fetchedAt: new Date(now).toISOString(), note: null };
  }

  // Empty result: keep any stale entry visible rather than wiping it.
  return {
    guides: hit?.guides ?? [],
    cached: !!hit,
    fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
    note: guides.length === 0 && !hit ? 'No field guides found for this species.' : null,
  };
}

export function registerCareGuideRoute(app: any, middlewares: any[] = []): void {
  app.get('/api/library/care-guide', ...middlewares, async (req: any, res: any) => {
    const species = String(req.query.species ?? '');
    if (!species.trim()) return res.status(400).json({ error: 'species query parameter is required' });
    try {
      res.json({ species, ...(await getCareGuide(species)) });
    } catch (err: any) {
      // The guide is a garnish on PlantDetail — a failure degrades to empty,
      // never a 500 that breaks the page.
      res.json({ species, guides: [], cached: false, fetchedAt: null, note: 'Care-guide lookup failed.' });
    }
  });
}
