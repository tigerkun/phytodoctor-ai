import { serpApiSearch, serpApiStatus } from '../lib/serpApiClient';

/**
 * Rare species conservation status (SerpApi, Feature 16) — the careGuide
 * discipline applied to a seventh surface:
 *
 *   - ONE engine call per species per 180 DAYS, shared by every account —
 *     conservation status changes slowly (years, not months).
 *   - Quota exhausted / breaker tripped / SerpApi down: serve a stale cache
 *     entry if one exists, else an honest empty answer. A broken SerpApi
 *     never blocks a PlantDetail render.
 *   - Organic results only — we search for "[species] IUCN status endangered
 *     protected" to get authoritative conservation data.
 */

const CACHE_TTL_MS = 180 * 86_400_000;
const MAX_RESULTS = 3;

export interface ConservationStatus {
  species: string;
  status: string | null;
  protected: boolean;
  citesListed: boolean;
  description: string | null;
  source: string;
  url: string;
  lastUpdated: string | null;
}

interface CacheRow {
  status: ConservationStatus;
  fetchedAt: number;
}

const cache = new Map<string, CacheRow>();

export function _resetConservationCacheForTests(): void {
  cache.clear();
}

export function conservationCacheSize(): number {
  return cache.size;
}

function normalizeSpecies(species: string): string {
  return species.trim().toLowerCase().slice(0, 80);
}

function extractConservationStatus(payload: any, species: string): ConservationStatus {
  const organic: any[] = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  const first = organic[0] || {};

  const title = String(first?.title ?? '');
  const snippet = String(first?.snippet ?? '');
  const source = String(first?.source ?? '');
  const url = String(first?.link ?? '');

  // Extract conservation status from title/snippet
  const statusMatch = (title + ' ' + snippet).match(/(endangered|vulnerable|near threatened|least concern|critically endangered|extinct|extinct in wild)/i);
  const status = statusMatch ? statusMatch[1].toLowerCase() : null;

  // Check for protected/CITES mentions
  const protectedMatch = (title + ' ' + snippet).match(/(protected|cites|appendix|listed|regulated)/i);
  const protected_ = !!protectedMatch;

  const citesMatch = (title + ' ' + snippet).match(/cites/i);
  const citesListed = !!citesMatch;

  // Extract description
  const descriptionMatch = snippet.match(/([^.!?]+[.!?])/);
  const description = descriptionMatch ? descriptionMatch[1].slice(0, 200) : snippet.slice(0, 200) || null;

  // Extract last updated if available
  const dateMatch = snippet.match(/(\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const lastUpdated = dateMatch ? dateMatch[1] : null;

  return {
    species,
    status,
    protected: protected_,
    citesListed,
    description,
    source,
    url,
    lastUpdated,
  };
}

export function registerConservationRoute(app: any): void {
  app.get('/api/library/conservation', async (req: any, res: any) => {
    try {
      const species = req.query.species as string;

      if (!species) {
        return res.status(400).json({ error: 'species is required' });
      }

      const normalizedSpecies = normalizeSpecies(species);
      const cacheKey = normalizedSpecies;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return res.json({ status: cached.status, fetchedAt: cached.fetchedAt });
      }

      // Check SerpApi status
      const status = serpApiStatus();
      if (!status.enabled) {
        // Serve stale cache if available
        if (cached) {
          return res.json({ status: cached.status, fetchedAt: cached.fetchedAt, stale: true });
        }
        return res.json({ status: null, fetchedAt: null, error: 'SerpApi unavailable' });
      }

      // Fetch from SerpApi
      const query = `${normalizedSpecies} IUCN status endangered protected CITES`;
      const payload = await serpApiSearch('google', {
        q: query,
        num: String(MAX_RESULTS),
        gl: 'us',
        hl: 'en',
      });

      const conservationStatus = extractConservationStatus(payload, normalizedSpecies);

      // Stale-over-empty: a transient "no status found" must not poison the
      // key for the next 180 days — an existing cache row survives a blank
      // fetch.
      if (conservationStatus) {
        cache.set(cacheKey, { status: conservationStatus, fetchedAt: Date.now() });
      }

      res.json({ status: conservationStatus, fetchedAt: conservationStatus ? Date.now() : cached?.fetchedAt ?? null });
    } catch (err) {
      // The response below carries the failure; no console noise needed.
      const species = req.query.species as string;
      const cacheKey = normalizeSpecies(species);
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({ status: cached.status, fetchedAt: cached.fetchedAt, stale: true });
      }
      res.status(500).json({ error: 'Failed to fetch conservation status' });
    }
  });
}
