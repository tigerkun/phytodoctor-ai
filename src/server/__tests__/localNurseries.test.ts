import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocalNurseries, registerLocalNurseriesRoute, _resetLocalNurseriesCacheForTests, localNurseriesCacheSize } from '../localNurseries';

// SerpApi mocked at the client boundary: the unit under test is the cache
// discipline (7-day TTL per normalized query, stale-over-empty, honest
// degradation), not the engine payload shape.
vi.mock('../../lib/serpApiClient', () => ({
  serpApiSearch: vi.fn(),
  serpApiStatus: vi.fn(() => ({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null })),
}));

import { serpApiSearch, serpApiStatus } from '../../lib/serpApiClient';

const NOW = Date.parse('2026-06-15T12:00:00');
const DAY = 86_400_000;

const nursery = (name: string, over: Record<string, any> = {}) => ({
  title: name,
  link: 'https://nursery.example.com',
  address: 'MG Road, Pune',
  phone: '+91 20 1234 5678',
  rating: 4.4,
  hours: 'Opens 9am',
  thumbnail: 'https://img.example/n.jpg',
  ...over,
});

describe('localNurseries cache', () => {
  beforeEach(() => {
    _resetLocalNurseriesCacheForTests();
    vi.mocked(serpApiSearch).mockReset();
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null });
  });

  it('the scan found the module it means to check', () => {
    expect(localNurseriesCacheSize()).toBe(0);
  });

  it('fetches once per normalized query per 7 days — case and whitespace insensitive', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [nursery('Green House')] });
    await getLocalNurseries('  plant nursery PUNE ', NOW);
    const second = await getLocalNurseries('plant nursery pune', NOW + 6 * DAY);
    expect(second.cached).toBe(true);
    expect(second.nurseries[0].name).toBe('Green House');
    expect(serpApiSearch).toHaveBeenCalledTimes(1);
  });

  it('extracts only what the engine returns — absent fields stay null', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({
      organic_results: [
        nursery('Full listing'),
        nursery('Sparse', { address: undefined, phone: undefined, rating: undefined, hours: undefined, thumbnail: undefined }),
      ],
    });
    const { nurseries } = await getLocalNurseries('pune nurseries', NOW);
    expect(nurseries).toHaveLength(2);
    expect(nurseries[0].address).toBe('MG Road, Pune');
    expect(nurseries[0].rating).toBe(4.4);
    expect(nurseries[1].address).toBeNull();
    expect(nurseries[1].phone).toBeNull();
    expect(nurseries[1].rating).toBeNull();
  });

  it('an empty result is answered honestly and never cached', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [] });
    const empty = await getLocalNurseries('middle of nowhere', NOW);
    expect(empty.nurseries).toEqual([]);
    expect(empty.note).toContain('No nurseries found');
    expect(empty.cached).toBe(false);
    // The key was never poisoned: a later query within the TTL fetches live.
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [nursery('Late Bloomer Nursery')] });
    const found = await getLocalNurseries('middle of nowhere', NOW + 2 * DAY);
    expect(found.nurseries[0].name).toBe('Late Bloomer Nursery');
    expect(serpApiSearch).toHaveBeenCalledTimes(2);
  });

  it('stale-over-nothing when SerpApi is unavailable', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [nursery('Green House')] });
    await getLocalNurseries('pune', NOW);
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: false, searchesUsed: 250, monthlyLimit: 250, disabledReason: 'quota' });
    const degraded = await getLocalNurseries('pune', NOW + 8 * DAY);
    expect(degraded.cached).toBe(true);
    expect(degraded.note).toContain('cached');
    const empty = await getLocalNurseries('delhi', NOW + 8 * DAY);
    expect(empty.nurseries).toEqual([]);
    expect(empty.note).toContain('unavailable');
  });

  it('an empty query is rejected without an engine call', async () => {
    await getLocalNurseries('   ', NOW);
    expect(serpApiSearch).not.toHaveBeenCalled();
  });
});

describe('localNurseries route registration', () => {
  it('registers the route with the required-parameter contract', () => {
    const routes: string[] = [];
    const app = { get: (path: string) => void routes.push(path) };
    registerLocalNurseriesRoute(app);
    expect(routes).toEqual(['/api/market/nurseries']);
  });
});
