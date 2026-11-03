import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCareGuide, _resetCareGuideCacheForTests, careGuideCacheSize } from '../careGuide';

// SerpApi is mocked at the client boundary: the unit under test is the
// cache discipline (7-day TTL, stale-over-nothing, quota-safe), not the
// engine payload shape.
vi.mock('../../lib/serpApiClient', () => ({
  serpApiSearch: vi.fn(),
  serpApiStatus: vi.fn(() => ({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null })),
}));

import { serpApiSearch, serpApiStatus } from '../../lib/serpApiClient';

const NOW = Date.parse('2026-06-15T12:00:00');
// SerpApi organic results carry the URL in `link` — the field extractGuides reads.
const guide = (title: string) => ({ title, source: 'garden.org', link: `https://example.org/${title}`, summary: 'Water weekly.' });

describe('careGuide cache', () => {
  beforeEach(() => {
    _resetCareGuideCacheForTests();
    vi.mocked(serpApiSearch).mockReset();
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null });
  });

  it('the scan found the module it means to check', () => {
    expect(careGuideCacheSize()).toBe(0);
  });

  it('fetches once per species and serves the cache within the TTL', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [guide('Fern care')] });
    const first = await getCareGuide('Nephrolepis exaltata', NOW);
    expect(first.guides).toHaveLength(1);
    expect(first.cached).toBe(false);
    const second = await getCareGuide('Nephrolepis exaltata', NOW + 6 * 86_400_000);
    expect(second.cached).toBe(true);
    expect(second.guides[0].title).toBe('Fern care');
    expect(serpApiSearch).toHaveBeenCalledTimes(1);
  });

  it('refetches after the 7-day TTL', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [guide('Fern care')] });
    await getCareGuide('Nephrolepis exaltata', NOW);
    await getCareGuide('Nephrolepis exaltata', NOW + 8 * 86_400_000);
    expect(serpApiSearch).toHaveBeenCalledTimes(2);
  });

  it('keeps species keys separate', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [guide('Care')] });
    await getCareGuide('ficus', NOW);
    await getCareGuide('monstera', NOW);
    expect(serpApiSearch).toHaveBeenCalledTimes(2);
  });

  it('stale-over-nothing when SerpApi is unavailable, and honest notes', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [guide('Fern care')] });
    await getCareGuide('Nephrolepis exaltata', NOW);
    const serpStatus = await import('../../lib/serpApiClient');
    vi.mocked(serpStatus.serpApiStatus).mockReturnValue({ enabled: false, searchesUsed: 99, monthlyLimit: 250, disabledReason: 'quota' });
    const degraded = await getCareGuide('Nephrolepis exaltata', NOW + 8 * 86_400_000);
    expect(degraded.cached).toBe(true);
    expect(degraded.note).toContain('cached');
    const empty = await getCareGuide('never-cached-species', NOW + 8 * 86_400_000);
    expect(empty.guides).toEqual([]);
    expect(empty.note).toContain('unavailable');
  });

  it('an empty organic result never wipes a good cache', async () => {
    vi.mocked(serpApiSearch).mockResolvedValueOnce({ organic_results: [guide('Fern care')] });
    await getCareGuide('Nephrolepis exaltata', NOW);
    vi.mocked(serpApiSearch).mockResolvedValueOnce({ organic_results: [] });
    const afterEmpty = await getCareGuide('Nephrolepis exaltata', NOW + 8 * 86_400_000);
    expect(afterEmpty.guides).toHaveLength(1);
  });
});
