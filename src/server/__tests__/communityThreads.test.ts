import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCommunityThreads, registerCommunityThreadsRoute, _resetCommunityThreadsCacheForTests, communityThreadsCacheSize } from '../communityThreads';

// SerpApi is mocked at the client boundary: the unit under test is the
// cache discipline (7-day TTL, stale-over-nothing, quota-safe) and the
// honesty rules (reddit-only results, subreddit from the URL, no invented
// upvotes), not the engine payload shape.
vi.mock('../../lib/serpApiClient', () => ({
  serpApiSearch: vi.fn(),
  serpApiStatus: vi.fn(() => ({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null })),
}));

import { serpApiSearch, serpApiStatus } from '../../lib/serpApiClient';

const NOW = Date.parse('2026-06-15T12:00:00');
const DAY = 86_400_000;

const thread = (title: string, path: string, over: Record<string, any> = {}) => ({
  title,
  link: `https://www.reddit.com${path}`,
  snippet: 'What worked for me was…',
  ...over,
});

describe('communityThreads cache', () => {
  beforeEach(() => {
    _resetCommunityThreadsCacheForTests();
    vi.mocked(serpApiSearch).mockReset();
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: true, searchesUsed: 0, monthlyLimit: 250, disabledReason: null });
  });

  it('the scan found the module it means to check', () => {
    expect(communityThreadsCacheSize()).toBe(0);
  });

  it('fetches once per (species, issue) pair per 7 days', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [thread('Monstera leaves browning', '/r/houseplants/comments/abc/monstera_help/')] });
    const first = await getCommunityThreads('Monstera deliciosa', 'problem care help', NOW);
    expect(first.threads).toHaveLength(1);
    expect(first.cached).toBe(false);
    const second = await getCommunityThreads('Monstera deliciosa', 'problem care help', NOW + 6 * DAY);
    expect(second.cached).toBe(true);
    expect(serpApiSearch).toHaveBeenCalledTimes(1);
  });

  it('a different issue phrase is a different cache key', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [thread('Generic', '/r/houseplants/comments/xyz/generic/')] });
    await getCommunityThreads('monstera', 'care tips', NOW);
    await getCommunityThreads('monstera', 'problem care help', NOW);
    expect(serpApiSearch).toHaveBeenCalledTimes(2);
  });

  it('derives the subreddit from the URL and filters non-reddit results', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({
      organic_results: [
        thread('Real thread', '/r/houseplants/comments/abc/help/'),
        thread('Off-site blog', '/r/gardening/comments/def/other/'), // kept: still reddit
        { title: 'Blog spam', link: 'https://plants.example.com/post' }, // filtered
        { title: 'No link' }, // filtered
      ],
    });
    const { threads } = await getCommunityThreads('monstera deliciosa', '', NOW);
    expect(threads).toHaveLength(2);
    expect(threads[0].subreddit).toBe('r/houseplants');
    expect(threads[1].subreddit).toBe('r/gardening');
  });

  it('the query scopes to r/houseplants and carries the issue phrase', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [] });
    await getCommunityThreads('monstera deliciosa', 'yellow leaves', NOW);
    expect(vi.mocked(serpApiSearch).mock.calls[0][1].q).toContain('site:reddit.com/r/houseplants');
    expect(vi.mocked(serpApiSearch).mock.calls[0][1].q).toContain('monstera deliciosa');
    expect(vi.mocked(serpApiSearch).mock.calls[0][1].q).toContain('yellow leaves');
  });

  it('a healthy plant\u2019s empty issue falls back to care-help phrasing', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [] });
    await getCommunityThreads('monstera deliciosa', '', NOW);
    expect(vi.mocked(serpApiSearch).mock.calls[0][1].q).toContain('care help');
  });

  it('stale-over-nothing when SerpApi is unavailable', async () => {
    vi.mocked(serpApiSearch).mockResolvedValue({ organic_results: [thread('Old thread', '/r/houseplants/comments/old/old/')] });
    await getCommunityThreads('monstera', 'problem', NOW);
    vi.mocked(serpApiStatus).mockReturnValue({ enabled: false, searchesUsed: 250, monthlyLimit: 250, disabledReason: 'quota' });
    const degraded = await getCommunityThreads('monstera', 'problem', NOW + 8 * DAY);
    expect(degraded.cached).toBe(true);
    expect(degraded.note).toContain('cached');
    const empty = await getCommunityThreads('never-queried', 'problem', NOW + 8 * DAY);
    expect(empty.threads).toEqual([]);
    expect(empty.note).toContain('unavailable');
  });

  it('an empty result never wipes a good cache', async () => {
    vi.mocked(serpApiSearch)
      .mockResolvedValueOnce({ organic_results: [thread('Good', '/r/houseplants/comments/good/good/')] })
      .mockResolvedValueOnce({ organic_results: [] });
    await getCommunityThreads('monstera', 'problem', NOW);
    const refetch = await getCommunityThreads('monstera', 'problem', NOW + 8 * DAY);
    expect(refetch.threads[0].title).toBe('Good');
    expect(refetch.note).toBeNull();
  });
});

describe('community route registration', () => {
  it('registers the route with the passed middlewares', () => {
    const calls: Array<{ path: string; middlewares: unknown[] }> = [];
    const app = {
      get(path: string, ...rest: unknown[]) {
        calls.push({ path, middlewares: rest.slice(0, -1) });
      },
    };
    const limiter = Symbol('limiter');
    registerCommunityThreadsRoute(app, [limiter]);
    expect(calls.map(c => c.path)).toEqual(['/api/library/community']);
    expect(calls[0].middlewares.includes(limiter)).toBe(true);
  });
});
