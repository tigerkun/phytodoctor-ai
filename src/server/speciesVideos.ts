import { serpApiSearch, serpApiStatus } from '../lib/serpApiClient';

/**
 * Species video tutorials (SerpApi youtube engine, Feature 14) — the
 * careGuide discipline applied to a third surface:
 *
 *   - ONE engine call per species per 30 DAYS, shared by every account —
 *     the cheapest surface in the SerpApi budget (care guides are weekly;
 *     video content barely changes month to month).
 *   - Quota exhausted / breaker tripped / SerpApi down: serve a stale cache
 *     entry if one exists, else an honest empty answer. A broken SerpApi
 *     never blocks a PlantDetail render.
 *   - Only REAL fields are returned: view counts and dates appear exactly
 *     as the engine printed them, or not at all.
 */

const CACHE_TTL_MS = 30 * 86_400_000;
const MAX_VIDEOS = 4;

export interface SpeciesVideo {
  title: string;
  url: string;
  thumbnail: string | null;
  channel: string | null;
  /** Display string exactly as the engine returned it ("1.2M views"). */
  views: string | null;
  /** Display string exactly as the engine returned it ("2 years ago"). */
  published: string | null;
  length: string | null;
}

interface CacheRow {
  videos: SpeciesVideo[];
  fetchedAt: number;
}

const cache = new Map<string, CacheRow>();

export function _resetSpeciesVideosCacheForTests(): void {
  cache.clear();
}

export function speciesVideosCacheSize(): number {
  return cache.size;
}

function normalizeSpecies(species: string): string {
  return species.trim().toLowerCase().slice(0, 80);
}

function extractVideos(payload: any): SpeciesVideo[] {
  const raw: any[] = Array.isArray(payload?.video_results) ? payload.video_results : [];
  const out: SpeciesVideo[] = [];
  for (const v of raw) {
    const title = typeof v?.title === 'string' ? v.title.trim() : '';
    const url = typeof v?.link === 'string' ? v.link : '';
    if (!title || !/^https?:\/\//.test(url)) continue;
    out.push({
      title: title.slice(0, 140),
      url,
      thumbnail: typeof v?.thumbnail === 'string' && v.thumbnail ? v.thumbnail : null,
      channel: typeof v?.channel?.name === 'string' && v.channel.name ? v.channel.name : null,
      views: typeof v?.views === 'string' && v.views ? v.views : null,
      published: typeof v?.published_date === 'string' && v.published_date ? v.published_date : null,
      length: typeof v?.length === 'string' && v.length ? v.length : null,
    });
    if (out.length >= MAX_VIDEOS) break;
  }
  return out;
}

export async function getSpeciesVideos(species: string, now: number = Date.now()): Promise<{
  videos: SpeciesVideo[];
  cached: boolean;
  fetchedAt: string | null;
  note: string | null;
}> {
  const key = normalizeSpecies(species);
  if (!key) return { videos: [], cached: false, fetchedAt: null, note: null };

  const hit = cache.get(key);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return { videos: hit.videos, cached: true, fetchedAt: new Date(hit.fetchedAt).toISOString(), note: null };
  }

  const status = serpApiStatus();
  if (!status.enabled) {
    return {
      videos: hit?.videos ?? [],
      cached: !!hit,
      fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
      note: hit ? 'Video lookup unavailable — showing the last cached results.' : 'Video lookup is unavailable right now.',
    };
  }

  const payload = await serpApiSearch('youtube', {
    q: `${key} houseplant care tips`,
  });

  const videos = payload ? extractVideos(payload) : [];
  if (videos.length > 0) {
    cache.set(key, { videos, fetchedAt: now });
    return { videos, cached: false, fetchedAt: new Date(now).toISOString(), note: null };
  }

  // Empty result: keep any stale entry visible rather than wiping it.
  return {
    videos: hit?.videos ?? [],
    cached: !!hit,
    fetchedAt: hit ? new Date(hit.fetchedAt).toISOString() : null,
    note: !hit ? 'No videos found for this species.' : null,
  };
}

export function registerSpeciesVideosRoute(app: any, middlewares: any[] = []): void {
  app.get('/api/library/videos', ...middlewares, async (req: any, res: any) => {
    const species = String(req.query.species ?? '');
    if (!species.trim()) return res.status(400).json({ error: 'species query parameter is required' });
    try {
      res.json({ species, ...(await getSpeciesVideos(species)) });
    } catch (err: any) {
      // Videos are a garnish on PlantDetail — a failure degrades to empty,
      // never a 500 that breaks the page.
      res.json({ species, videos: [], cached: false, fetchedAt: null, note: 'Video lookup failed.' });
    }
  });
}
