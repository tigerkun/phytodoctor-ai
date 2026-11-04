import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpeciesVideos, registerSpeciesVideosRoute, _resetSpeciesVideosCacheForTests, speciesVideosCacheSize } from '../speciesVideos';

// SerpApi is mocked at the client boundary: the unit under test is the
// cache discipline (30-day TTL, stale-over-nothing, quota-safe), not the
// engine payload shape.
vi.mock('../../lib/serpApiClient', () => ({
  serpApiSearch: vi.fn(),
  serpApiStatus: vi.fn(() => ({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null })),
}));

import { serpApiSearch, serpApiStatus } from '../../lib/serpApiClient';

const NOW = Date.parse('2026-06-15T12:00:00');
const DAY = 86_400_000;

const video = (title: string, over: Record<string, any> = {}) => ({
  title,
  link: `https://youtube.com/watch?v=${title.replace(/\s+/g, '-')}`,
  thumbnail: 'https://img.example/v.jpg',
  channel: { name: 'Plant Coach' },
  views: '84,213 views',
  published_date: '1 year ago',
  length: '8:24',
  ...over,
});

describe('speciesVideos cache', () => {
  beforeEach(() => {
    _resetSpeciesVideosCacheForTests();
    vi.mocked(serpApiSearch).mockReset();
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null });
  });

  it('the scan found the module it means to check', () => {
    expect(speciesVideosCacheSize()).toBe(0);
  });

  it('fetches once per species per 30 days, shared by every account', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ video_results: [video('Monstera care 101')] });
    const first = await getSpeciesVideos('Monstera deliciosa', NOW);
    expect(first.videos).toHaveLength(1);
    expect(first.cached).toBe(false);
    const second = await getSpeciesVideos('Monstera deliciosa', NOW + 29 * DAY);
    expect(second.cached).toBe(true);
    expect(serpApiSearch).toHaveBeenCalledTimes(1);
  });

  it('refetches after the 30-day TTL', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ video_results: [video('Care guide')] });
    await getSpeciesVideos('Nephrolepis exaltata', NOW);
    await getSpeciesVideos('Nephrolepis exaltata', NOW + 31 * DAY);
    expect(serpApiSearch).toHaveBeenCalledTimes(2);
  });

  it('extracts only real fields — views and dates as printed, or absent', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({
      video_results: [
        video('Full metadata'),
        video('Bare', { views: undefined, published_date: undefined, length: undefined, channel: null }),
        { link: 'https://youtube.com/watch?v=x' }, // filtered: no title
        { title: 'No link' }, // filtered: no url
      ],
    });
    const { videos } = await getSpeciesVideos('monstera', NOW);
    expect(videos).toHaveLength(2);
    expect(videos[0].channel).toBe('Plant Coach');
    expect(videos[0].views).toBe('84,213 views');
    expect(videos[1].views).toBeNull();
    expect(videos[1].channel).toBeNull();
  });

  it('stale-over-nothing when SerpApi is unavailable', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ video_results: [video('Fern repotting')] });
    await getSpeciesVideos('Nephrolepis exaltata', NOW);
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: false, searchesUsed: 250, monthlyLimit: 250, disabledReason: 'quota' });
    const degraded = await getSpeciesVideos('Nephrolepis exaltata', NOW + 31 * DAY);
    expect(degraded.cached).toBe(true);
    expect(degraded.note).toContain('cached');
    const empty = await getSpeciesVideos('never-queried-species', NOW + 31 * DAY);
    expect(empty.videos).toEqual([]);
    expect(empty.note).toContain('unavailable');
  });

  it('an empty result never wipes a good cache', async () => {
    vi.mocked(serpApiSearch)
      .mockResolvedValueOnce({ video_results: [video('Keep it alive')] })
      .mockResolvedValueOnce({ video_results: [] });
    await getSpeciesVideos('Sansevieria trifasciata', NOW);
    const refetch = await getSpeciesVideos('Sansevieria trifasciata', NOW + 31 * DAY);
    expect(refetch.videos[0].title).toBe('Keep it alive');
    expect(refetch.note).toBeNull();
  });

  it('keeps species keys separate', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ video_results: [video('Generic')] });
    await getSpeciesVideos('ficus lyrata', NOW);
    await getSpeciesVideos('ficus benjamina', NOW);
    expect(serpApiSearch).toHaveBeenCalledTimes(2);
  });
});

describe('species videos route registration', () => {
  it('registers the route with the passed middlewares', () => {
    const calls: Array<{ path: string; middlewares: unknown[] }> = [];
    const app = {
      get(path: string, ...rest: unknown[]) {
        calls.push({ path, middlewares: rest.slice(0, -1) });
      },
    };
    const limiter = Symbol('limiter');
    registerSpeciesVideosRoute(app, [limiter]);
    expect(calls.map(c => c.path)).toEqual(['/api/library/videos']);
    expect(calls[0].middlewares.includes(limiter)).toBe(true);
  });
});
