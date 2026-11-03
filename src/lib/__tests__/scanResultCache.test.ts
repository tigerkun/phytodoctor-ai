import { describe, it, expect } from 'vitest';
import { createScanCache, scanCacheKey } from '../scanResultCache';

describe('createScanCache', () => {
  it('the scan found the cache it means to check', () => {
    expect(createScanCache(1, 1000).size).toBe(0);
  });

  it('returns the cached entry with its timestamp on a hit', () => {
    const cache = createScanCache<string>(5, 60_000);
    cache.put('a', 'verdict-a', 1000);
    const hit = cache.get('a', 2000);
    expect(hit?.result).toBe('verdict-a');
    expect(hit?.timestamp).toBe(1000);
  });

  it('expires entries past the TTL and drops them on read', () => {
    const cache = createScanCache<string>(5, 5 * 60_000);
    cache.put('a', 'old', 0);
    expect(cache.get('a', 5 * 60_000 - 1)?.result).toBe('old');
    expect(cache.get('a', 5 * 60_000 + 1)).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('keeps at most maxEntries, evicting the oldest', () => {
    const cache = createScanCache<string>(20, 60_000);
    for (let i = 0; i < 21; i++) cache.put(`k${i}`, `v${i}`, i);
    expect(cache.size).toBe(20);
    expect(cache.get('k0', 100)).toBeNull();
    expect(cache.get('k20', 100)?.result).toBe('v20');
  });

  it('a re-scan refreshes recency instead of counting as stale', () => {
    const cache = createScanCache<string>(2, 60_000);
    cache.put('a', 'first', 0);
    cache.put('b', 'x', 1);
    // 'a' is still resident here — re-putting it must move it to newest.
    // Without the delete-first refresh, a would stay oldest and 'c' below
    // would evict it instead of 'b'.
    cache.put('a', 'again', 2);
    cache.put('c', 'y', 3);
    expect(cache.get('a', 4)?.result).toBe('again');
    expect(cache.get('b', 4)).toBeNull();
    expect(cache.get('c', 4)?.result).toBe('y');
    expect(cache.size).toBe(2);
  });
});

describe('scanCacheKey', () => {
  it('is stable for the same image and location', async () => {
    const a = await scanCacheKey('base64payload');
    const b = await scanCacheKey('base64payload');
    expect(a).toBe(b);
  });

  it('separates the same image across different locations', async () => {
    const city = await scanCacheKey('base64payload', { city: 'Pune' });
    const other = await scanCacheKey('base64payload', { city: 'Guwahati' });
    expect(city).not.toBe(other);
  });

  it('separates different images outright', async () => {
    const a = await scanCacheKey('image-one');
    const b = await scanCacheKey('image-two');
    expect(a).not.toBe(b);
  });
});
