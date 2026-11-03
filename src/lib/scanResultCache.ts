/**
 * Short-lived result cache for plant scans, shared by every surface that
 * calls identifyPlant. A re-mount of the Lab or Clinic loses the component
 * state, so the same photo picked again minutes later would re-bill the
 * Gemini path for a verdict the app already holds. This serves that verdict
 * instantly and keeps it off the quota.
 *
 * Deliberately in-memory only: 20 entries and 5 minutes bound both the
 * memory and the staleness a cached verdict can carry. A page refresh
 * dropping the cache is a feature, not a gap — the next scan re-bills and
 * re-earns, exactly like today.
 */

export interface ScanCacheEntry<T> {
  result: T;
  timestamp: number;
}

export interface ScanCache<T> {
  /** The cached entry, or null when absent or older than the TTL. */
  get(key: string, now?: number): ScanCacheEntry<T> | null;
  put(key: string, result: T, now?: number): void;
  readonly size: number;
}

export function createScanCache<T>(maxEntries: number, ttlMs: number): ScanCache<T> {
  const store = new Map<string, ScanCacheEntry<T>>();
  return {
    get(key: string, now: number = Date.now()): ScanCacheEntry<T> | null {
      const entry = store.get(key);
      if (!entry) return null;
      if (now - entry.timestamp > ttlMs) {
        store.delete(key);
        return null;
      }
      return entry;
    },
    put(key: string, result: T, now: number = Date.now()): void {
      // Re-inserting refreshes recency: a re-scan of an old image counts as
      // a recent use, not a stale leftover.
      store.delete(key);
      store.set(key, { result, timestamp: now });
      while (store.size > maxEntries) {
        // Map keeps insertion order — the first key is the oldest.
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    get size(): number {
      return store.size;
    },
  };
}

/**
 * Cache key for a scan: SHA-256 of the prepared base64 image, prefixed into
 * the key along with the location context — the same photo from another
 * city earns different location-aware fields, so it is a different scan.
 * 16 hex chars (64 bits) is plenty against collisions at 20 entries.
 */
export async function scanCacheKey(base64Image: string, location?: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base64Image));
  const hex = Array.from(new Uint8Array(digest).slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const loc = location ? JSON.stringify(location) : '';
  return `${hex}:${loc}`;
}
