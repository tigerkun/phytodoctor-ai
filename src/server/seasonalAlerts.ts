import { serpApiSearch, serpApiStatus } from '../lib/serpApiClient';

/**
 * Seasonal care alerts (SerpApi, Feature 11) — the careGuide discipline
 * applied to a fifth surface:
 *
 *   - ONE engine call per (season, climate zone) pair per 90 DAYS, shared by
 *     every account — seasonal advice changes slowly and is largely universal.
 *   - Quota exhausted / breaker tripped / SerpApi down: serve a stale cache
 *     entry if one exists, else an honest empty answer. A broken SerpApi
 *     never blocks a plant care render.
 *   - Organic results only — no shopping, no ads. We search for "[season]
 *     [climate] houseplant care tips" to get evidence-based seasonal advice.
 */

const CACHE_TTL_MS = 90 * 86_400_000;
const MAX_TIPS = 6;

export interface SeasonalTip {
  tip: string;
  source: string;
  url: string;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  appliesTo: string[];
}

interface CacheRow {
  tips: SeasonalTip[];
  fetchedAt: number;
}

const cache = new Map<string, CacheRow>();

export function _resetSeasonalAlertsCacheForTests(): void {
  cache.clear();
}

export function seasonalAlertsCacheSize(): number {
  return cache.size;
}

function normalizeSeason(season: string): string {
  return season.trim().toLowerCase().slice(0, 20);
}

function normalizeClimate(climate: string): string {
  return climate.trim().toLowerCase().slice(0, 30);
}

function extractTips(payload: any): SeasonalTip[] {
  const organic: any[] = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  return organic
    .slice(0, MAX_TIPS)
    .map(r => {
      const title = String(r?.title ?? '').slice(0, 140);
      const snippet = String(r?.snippet ?? '').slice(0, 300);
      const source = String(r?.source ?? '');
      const url = String(r?.link ?? '');

      // Extract priority from title/snippet
      const priorityMatch = (title + ' ' + snippet).match(/(urgent|important|critical|essential|recommended|optional)/i);
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (priorityMatch) {
        const p = priorityMatch[1].toLowerCase();
        if (['urgent', 'important', 'critical', 'essential'].includes(p)) priority = 'high';
        else if (p === 'recommended') priority = 'medium';
        else priority = 'low';
      }

      // Extract plant types from title/snippet
      const plantTypes: string[] = [];
      const plantKeywords = ['succulent', 'cactus', 'fern', 'orchid', 'monstera', 'pothos', 'snake plant', 'zz plant', 'peace lily', 'spider plant'];
      const text = (title + ' ' + snippet).toLowerCase();
      for (const keyword of plantKeywords) {
        if (text.includes(keyword)) plantTypes.push(keyword);
      }

      // Clean up tip from title
      const tip = title.replace(/\s*[-–|].*$/, '').trim() || title;

      return {
        tip,
        source,
        url,
        summary: snippet,
        priority,
        appliesTo: plantTypes,
      };
    })
    .filter(t => t.tip && t.url);
}

export function registerSeasonalAlertsRoute(app: any): void {
  app.get('/api/library/seasonal-alerts', async (req: any, res: any) => {
    try {
      const season = req.query.season as string;
      const climate = req.query.climate as string;

      if (!season || !climate) {
        return res.status(400).json({ error: 'season and climate are required' });
      }

      const normalizedSeason = normalizeSeason(season);
      const normalizedClimate = normalizeClimate(climate);
      const cacheKey = `${normalizedSeason}:${normalizedClimate}`;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return res.json({ tips: cached.tips, fetchedAt: cached.fetchedAt });
      }

      // Check SerpApi status
      const status = serpApiStatus();
      if (!status.enabled) {
        // Serve stale cache if available
        if (cached) {
          return res.json({ tips: cached.tips, fetchedAt: cached.fetchedAt, stale: true });
        }
        return res.json({ tips: [], fetchedAt: null, error: 'SerpApi unavailable' });
      }

      // Fetch from SerpApi
      const query = `${normalizedSeason} ${normalizedClimate} houseplant care tips seasonal`;
      const payload = await serpApiSearch('google', {
        q: query,
        num: String(MAX_TIPS * 2), // Fetch extra to filter
        gl: 'us',
        hl: 'en',
      });

      const tips = extractTips(payload);

      // Cache the result
      cache.set(cacheKey, { tips, fetchedAt: Date.now() });

      res.json({ tips, fetchedAt: Date.now() });
    } catch (err) {
      console.error('[seasonal-alerts] error:', err);
      // Serve stale cache on error
      const season = req.query.season as string;
      const climate = req.query.climate as string;
      const cacheKey = `${normalizeSeason(season)}:${normalizeClimate(climate)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({ tips: cached.tips, fetchedAt: cached.fetchedAt, stale: true });
      }
      res.status(500).json({ error: 'Failed to fetch seasonal alerts' });
    }
  });
}
