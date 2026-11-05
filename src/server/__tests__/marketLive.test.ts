import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMarketLive,
  getTrendingPlants,
  registerMarketLiveRoute,
  LIVE_CATEGORIES,
  _resetMarketLiveCacheForTests,
  marketLiveCacheSize,
} from '../marketLive';

// SerpApi is mocked at the client boundary: the unit under test is the
// cache discipline (7-day TTL, shared weekly budget, price history,
// stale-over-nothing), not the engine payload shape.
vi.mock('../../lib/serpApiClient', () => ({
  serpApiSearch: vi.fn(),
  serpApiStatus: vi.fn(() => ({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null })),
}));

import { serpApiSearch, serpApiStatus } from '../../lib/serpApiClient';

const NOW = Date.parse('2026-06-15T12:00:00');
const DAY = 86_400_000;

const listing = (title: string, price: number, over: Record<string, any> = {}) => ({
  title,
  source: 'GreenHouse Co',
  price: `₹${price}`,
  extracted_price: price,
  rating: 4.5,
  reviews: 120,
  thumbnail: 'https://img.example/t.jpg',
  product_link: `https://shop.example/${title}`,
  ...over,
});

describe('marketLive cache + quota', () => {
  beforeEach(() => {
    _resetMarketLiveCacheForTests();
    vi.mocked(serpApiSearch).mockReset();
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null });
  });

  it('the scan found the module it means to check', () => {
    expect(marketLiveCacheSize()).toBe(0);
    // Six categories — the parallel session's marketProducts.ts was
    // consolidated into this cache (books, other absorbed; one shopping
    // surface, one quota cost).
    expect(Object.keys(LIVE_CATEGORIES)).toEqual(['care', 'home', 'tools', 'seeds', 'books', 'other']);
  });

  it('extracts only real fields — rating present only when the engine has one', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({
      shopping_results: [
        listing('Neem oil spray', 349),
        listing('No-rating fertiliser', 199, { rating: undefined, reviews: undefined }),
        { title: '', source: 'junk' }, // filtered: no title
      ],
    });
    const { items } = await getMarketLive('care', NOW);
    expect(items).toHaveLength(2);
    expect(items[0].rating).toBe(4.5);
    expect(items[0].reviews).toBe(120);
    expect(items[0].priceDisplay).toBe('₹349');
    expect(items[1].rating).toBeNull();
    expect(items[1].reviews).toBeNull();
  });

  it('fetches once per category per week, shared by every account', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ shopping_results: [listing('Pots', 599)] });
    await getMarketLive('home', NOW);
    const second = await getMarketLive('home', NOW + 6 * DAY);
    expect(second.cached).toBe(true);
    expect(second.items[0].title).toBe('Pots');
    expect(serpApiSearch).toHaveBeenCalledTimes(1);
  });

  it('keeps a price memory: the next fetch carries what the last one saw', async () => {
    vi.mocked(serpApiSearch)
      .mockResolvedValueOnce({ shopping_results: [listing('Neem oil', 349)] })
      .mockResolvedValueOnce({ shopping_results: [listing('Neem oil', 299)] });
    await getMarketLive('care', NOW);
    const refresh = await getMarketLive('care', NOW + 8 * DAY);
    expect(refresh.cached).toBe(false);
    expect(refresh.items[0].priceValue).toBe(299);
    expect(refresh.items[0].previousPrice).toBe(349);
  });

  it('an unknown category is an honest empty answer, not a search', async () => {
    const result = await getMarketLive('crypto', NOW);
    expect(result.items).toEqual([]);
    expect(result.note).toContain('Unknown category');
    expect(serpApiSearch).not.toHaveBeenCalled();
  });

  it('stale-over-nothing when SerpApi is unavailable', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ shopping_results: [listing('Shears', 449)] });
    await getMarketLive('tools', NOW);
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: false, searchesUsed: 250, monthlyLimit: 250, disabledReason: 'quota' });
    const degraded = await getMarketLive('tools', NOW + 8 * DAY);
    expect(degraded.cached).toBe(true);
    expect(degraded.note).toContain('cached');
    const empty = await getMarketLive('tools', NOW + 9 * DAY);
    // Same TTL window... move past it: the cached row is now stale and the
    // breaker is still tripped — stale is served again, note included.
    expect(empty.items[0].title).toBe('Shears');
    const never = await getMarketLive('seeds', NOW + 8 * DAY);
    expect(never.items).toEqual([]);
    expect(never.note).toContain('unavailable');
  });

  it('an empty shopping result never wipes a good cache', async () => {
    vi.mocked(serpApiSearch)
      .mockResolvedValueOnce({ shopping_results: [listing('Moss pole', 299)] })
      .mockResolvedValueOnce({ shopping_results: [] });
    await getMarketLive('home', NOW);
    const refetch = await getMarketLive('home', NOW + 8 * DAY);
    expect(refetch.items[0].title).toBe('Moss pole');
    expect(refetch.note).toBeNull();
  });
});

describe('trending plants', () => {
  beforeEach(() => {
    _resetMarketLiveCacheForTests();
    vi.mocked(serpApiSearch).mockReset();
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null });
  });

  it('one call per week for everyone, real headlines only', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({
      organic_results: [
        { title: 'Why everyone is growing String of Turtles', source: 'Leaf & Clay', link: 'https://blog.example/turtles', snippet: 'The little windows...' },
        { title: 'No link here', source: 'x' }, // filtered
      ],
    });
    const first = await getTrendingPlants(NOW);
    expect(first.items).toHaveLength(1);
    expect(first.items[0].url).toBe('https://blog.example/turtles');
    const second = await getTrendingPlants(NOW + 6 * DAY);
    expect(second.cached).toBe(true);
    expect(serpApiSearch).toHaveBeenCalledTimes(1);
  });

  it('degrades to stale or empty with a note when the breaker is tripped', async () => {
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: false, searchesUsed: 250, monthlyLimit: 250, disabledReason: 'quota' });
    const empty = await getTrendingPlants(NOW);
    expect(empty.items).toEqual([]);
    expect(empty.note).toContain('unavailable');
  });
});

describe('market routes registration', () => {
  it('registers both routes with the passed middlewares', () => {
    const calls: Array<{ path: string; middlewares: unknown[] }> = [];
    const app = {
      get(path: string, ...rest: unknown[]) {
        calls.push({ path, middlewares: rest.slice(0, -1) });
      },
    };
    const limiter = Symbol('limiter');
    registerMarketLiveRoute(app, [limiter]);
    expect(calls.map(c => c.path)).toEqual(['/api/market/live', '/api/market/trending']);
    expect(calls.every(c => c.middlewares.includes(limiter))).toBe(true);
  });
});
