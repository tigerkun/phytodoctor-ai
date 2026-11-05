import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * Conservation status (SERP Feature 16) — source-level tests following
 * the established pattern. Each scan first proves it found the structures
 * it means to police.
 */

const conservation = stripJsComments(readSource('src/server/conservation.ts'));
const serverEntry = stripJsComments(readSource('server.ts'));

describe('conservation server module', () => {
  it('the scan found the module it means to check', () => {
    expect(conservation).toContain('registerConservationRoute');
  });

  it('exports the route registration function', () => {
    expect(conservation).toContain('export function registerConservationRoute');
  });

  it('uses serpApiSearch for fetching', () => {
    expect(conservation).toContain('serpApiSearch');
  });

  it('checks serpApiStatus before fetching', () => {
    expect(conservation).toContain('serpApiStatus');
  });

  it('has cache with TTL', () => {
    expect(conservation).toContain('CACHE_TTL_MS');
    expect(conservation).toContain('cache.set');
    expect(conservation).toContain('cache.get');
  });

  it('extracts conservation status from organic results', () => {
    expect(conservation).toContain('extractConservationStatus');
    expect(conservation).toContain('organic_results');
  });

  it('requires species parameter', () => {
    expect(conservation).toContain('species');
    expect(conservation).toContain('400');
  });

  it('has cache reset function for tests', () => {
    expect(conservation).toContain('_resetConservationCacheForTests');
  });

  it('serves stale cache on error', () => {
    expect(conservation).toContain('stale: true');
    expect(conservation).toContain('cached');
  });

  it('extracts conservation data fields', () => {
    expect(conservation).toContain('status');
    expect(conservation).toContain('protected');
    expect(conservation).toContain('citesListed');
    expect(conservation).toContain('description');
    expect(conservation).toContain('lastUpdated');
  });

  it('searches for IUCN status', () => {
    expect(conservation).toContain('IUCN');
    expect(conservation).toContain('endangered');
    expect(conservation).toContain('protected');
    expect(conservation).toContain('CITES');
  });
});

describe('server wiring', () => {
  it('imports the conservation route', () => {
    expect(serverEntry).toContain('import { registerConservationRoute } from "./src/server/conservation";');
  });

  it('registers the route', () => {
    expect(serverEntry).toContain('registerConservationRoute(app);');
  });
});

describe('stale-over-empty discipline (consolidation hardening)', () => {
  it('a transient no-status result never poisons the 180-day cache', () => {
    expect(conservation).toContain('if (conservationStatus?.status) {');
    expect(conservation).toContain('cache.set(cacheKey, { status: conservationStatus, fetchedAt: Date.now() })');
  });

  it('degrades without console noise', () => {
    expect(conservation).not.toContain('console.error');
  });
});
