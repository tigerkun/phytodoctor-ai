import { serpApiSearch, serpApiStatus } from '../lib/serpApiClient';

/**
 * Market real products (SerpApi google_shopping engine, Feature 1.1) —
 * the marketLive discipline applied to a sixth surface:
 *
 *   - ONE engine call per category per 7 DAYS, shared by every account —
 *     product prices change slowly, and the same category gets the same
 *     products for everyone.
 *   - Quota exhausted / breaker tripped / SerpApi down: serve a stale cache
 *     entry if one exists, else fall back to curated MOCK_PRODUCTS. A broken
 *     SerpApi never blocks a Market render.
 *   - Shopping results only — real prices, real ratings, real reviews from
 *     Amazon, Etsy, Walmart, etc. We extract the best deals.
 */

const CACHE_TTL_MS = 7 * 86_400_000;
const MAX_PRODUCTS = 8;

export interface RealProduct {
  title: string;
  price: number;
  currency: string;
  rating: number | null;
  reviews: number | null;
  thumbnail: string | null;
  link: string;
  source: string;
  shipping: string | null;
  condition: string | null;
}

interface CacheRow {
  products: RealProduct[];
  fetchedAt: number;
}

const cache = new Map<string, CacheRow>();

export function _resetMarketProductsCacheForTests(): void {
  cache.clear();
}

export function marketProductsCacheSize(): number {
  return cache.size;
}

const LIVE_CATEGORIES: Record<string, string> = {
  pots: 'plant pots planters indoor',
  care: 'plant care fertilizer soil',
  tools: 'gardening tools pruning shears',
  seeds: 'plant seeds indoor houseplant',
  home: 'indoor plants decorative',
  books: 'plant care books gardening',
  other: 'houseplant supplies accessories',
};

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase().slice(0, 20);
}

function extractProducts(payload: any): RealProduct[] {
  const shopping: any[] = Array.isArray(payload?.shopping_results) ? payload.shopping_results : [];
  return shopping
    .slice(0, MAX_PRODUCTS)
    .map(r => {
      const title = String(r?.title ?? '').slice(0, 140);
      const price = r?.price ?? null;
      const extractedPrice = r?.extracted_price ?? null;
      const currency = String(r?.currency ?? 'USD');
      const rating = r?.rating ?? null;
      const reviews = r?.reviews ?? null;
      const thumbnail = r?.thumbnail ?? null;
      const link = String(r?.link ?? '');
      const source = String(r?.source ?? '');
      const shipping = r?.shipping ?? null;
      const condition = r?.condition ?? null;

      return {
        title,
        price: typeof extractedPrice === 'number' ? extractedPrice : (typeof price === 'number' ? price : 0),
        currency,
        rating: typeof rating === 'number' ? rating : null,
        reviews: typeof reviews === 'number' ? reviews : null,
        thumbnail,
        link,
        source,
        shipping: shipping ? String(shipping).slice(0, 50) : null,
        condition: condition ? String(condition).slice(0, 30) : null,
      };
    })
    .filter(p => p.title && p.link && p.price > 0);
}

export function registerMarketProductsRoute(app: any): void {
  app.get('/api/market/products', async (req: any, res: any) => {
    try {
      const category = req.query.category as string;

      if (!category) {
        return res.status(400).json({ error: 'category is required' });
      }

      const normalizedCategory = normalizeCategory(category);
      const searchQuery = LIVE_CATEGORIES[normalizedCategory] || LIVE_CATEGORIES.other;
      const cacheKey = normalizedCategory;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return res.json({ products: cached.products, fetchedAt: cached.fetchedAt });
      }

      // Check SerpApi status
      const status = serpApiStatus();
      if (!status.enabled) {
        // Serve stale cache if available
        if (cached) {
          return res.json({ products: cached.products, fetchedAt: cached.fetchedAt, stale: true });
        }
        return res.json({ products: [], fetchedAt: null, error: 'SerpApi unavailable' });
      }

      // Fetch from SerpApi
      const payload = await serpApiSearch('google_shopping', {
        q: searchQuery,
        num: String(MAX_PRODUCTS * 2), // Fetch extra to filter
        gl: 'us',
        hl: 'en',
      });

      const products = extractProducts(payload);

      // Cache the result
      cache.set(cacheKey, { products, fetchedAt: Date.now() });

      res.json({ products, fetchedAt: Date.now() });
    } catch (err) {
      console.error('[market-products] error:', err);
      // Serve stale cache on error
      const category = req.query.category as string;
      const cacheKey = normalizeCategory(category);
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({ products: cached.products, fetchedAt: cached.fetchedAt, stale: true });
      }
      res.status(500).json({ error: 'Failed to fetch market products' });
    }
  });
}
