import { serpApiSearch, serpApiStatus } from '../lib/serpApiClient';

/**
 * Pest treatment research (SerpApi, Feature 10) — the careGuide discipline
 * applied to a fourth surface:
 *
 *   - ONE engine call per (pest, plant species) pair per 14 DAYS, shared by
 *     every account — pest treatments change slowly, and the same pest on
 *     the same plant type gets the same advice.
 *   - Quota exhausted / breaker tripped / SerpApi down: serve a stale cache
 *     entry if one exists, else an honest empty answer. A broken SerpApi
 *     never blocks a diagnosis render.
 *   - Organic results only — no shopping, no ads. We search for "[pest]
 *     treatment [plant species] organic" to get evidence-based advice.
 */

const CACHE_TTL_MS = 14 * 86_400_000;
const MAX_TREATMENTS = 5;

export interface PestTreatment {
  treatment: string;
  source: string;
  url: string;
  summary: string;
  effectiveness: string | null;
}

interface CacheRow {
  treatments: PestTreatment[];
  fetchedAt: number;
}

const cache = new Map<string, CacheRow>();

export function _resetPestTreatmentsCacheForTests(): void {
  cache.clear();
}

export function pestTreatmentsCacheSize(): number {
  return cache.size;
}

function normalizePest(pest: string): string {
  return pest.trim().toLowerCase().slice(0, 60);
}

function normalizeSpecies(species: string): string {
  return species.trim().toLowerCase().slice(0, 80);
}

function extractTreatments(payload: any): PestTreatment[] {
  const organic: any[] = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  return organic
    .slice(0, MAX_TREATMENTS)
    .map(r => {
      const title = String(r?.title ?? '').slice(0, 140);
      const snippet = String(r?.snippet ?? '').slice(0, 300);
      const source = String(r?.source ?? '');
      const url = String(r?.link ?? '');

      // Extract effectiveness hints from title/snippet
      const effectivenessMatch = (title + ' ' + snippet).match(/(\d+%|highly effective|moderately effective|low effectiveness)/i);
      const effectiveness = effectivenessMatch ? effectivenessMatch[1] : null;

      // Clean up treatment name from title
      const treatment = title.replace(/\s*[-–|].*$/, '').trim() || title;

      return {
        treatment,
        source,
        url,
        summary: snippet,
        effectiveness,
      };
    })
    .filter(t => t.treatment && t.url);
}

export function registerPestTreatmentsRoute(app: any): void {
  app.get('/api/library/pest-treatments', async (req: any, res: any) => {
    try {
      const pest = req.query.pest as string;
      const species = req.query.species as string;

      if (!pest || !species) {
        return res.status(400).json({ error: 'pest and species are required' });
      }

      const normalizedPest = normalizePest(pest);
      const normalizedSpecies = normalizeSpecies(species);
      const cacheKey = `${normalizedPest}:${normalizedSpecies}`;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return res.json({ treatments: cached.treatments, fetchedAt: cached.fetchedAt });
      }

      // Check SerpApi status
      const status = serpApiStatus();
      if (!status.enabled) {
        // Serve stale cache if available
        if (cached) {
          return res.json({ treatments: cached.treatments, fetchedAt: cached.fetchedAt, stale: true });
        }
        return res.json({ treatments: [], fetchedAt: null, error: 'SerpApi unavailable' });
      }

      // Fetch from SerpApi
      const query = `${normalizedPest} treatment ${normalizedSpecies} organic effective`;
      const payload = await serpApiSearch('google', {
        q: query,
        num: String(MAX_TREATMENTS * 2), // Fetch extra to filter
        gl: 'us',
        hl: 'en',
      });

      const treatments = extractTreatments(payload);

      // Stale-over-empty: a transient empty result must not poison the key
      // for the next 14 days — an existing cache row survives a blank fetch.
      if (treatments.length > 0) {
        cache.set(cacheKey, { treatments, fetchedAt: Date.now() });
      }

      res.json({ treatments, fetchedAt: treatments.length > 0 ? Date.now() : cached?.fetchedAt ?? null });
    } catch (err) {
      // The response below carries the failure; no console noise needed.
      const pest = req.query.pest as string;
      const species = req.query.species as string;
      const cacheKey = `${normalizePest(pest)}:${normalizeSpecies(species)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({ treatments: cached.treatments, fetchedAt: cached.fetchedAt, stale: true });
      }
      res.status(500).json({ error: 'Failed to fetch pest treatments' });
    }
  });
}
