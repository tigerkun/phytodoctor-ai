import { describe, it, expect, beforeEach } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * Pest treatment research (SERP Feature 10) — source-level tests following
 * the established pattern. Each scan first proves it found the structures
 * it means to police.
 */

const pestTreatments = stripJsComments(readSource('src/server/pestTreatments.ts'));
const serverEntry = stripJsComments(readSource('server.ts'));

describe('pest treatments server module', () => {
  it('the scan found the module it means to check', () => {
    expect(pestTreatments).toContain('registerPestTreatmentsRoute');
  });

  it('exports the route registration function', () => {
    expect(pestTreatments).toContain('export function registerPestTreatmentsRoute');
  });

  it('uses serpApiSearch for fetching', () => {
    expect(pestTreatments).toContain('serpApiSearch');
  });

  it('checks serpApiStatus before fetching', () => {
    expect(pestTreatments).toContain('serpApiStatus');
  });

  it('has cache with TTL', () => {
    expect(pestTreatments).toContain('CACHE_TTL_MS');
    expect(pestTreatments).toContain('cache.set');
    expect(pestTreatments).toContain('cache.get');
  });

  it('extracts treatments from organic results', () => {
    expect(pestTreatments).toContain('extractTreatments');
    expect(pestTreatments).toContain('organic_results');
  });

  it('requires pest and species parameters', () => {
    expect(pestTreatments).toContain('pest');
    expect(pestTreatments).toContain('species');
    expect(pestTreatments).toContain('400');
  });

  it('has cache reset function for tests', () => {
    expect(pestTreatments).toContain('_resetPestTreatmentsCacheForTests');
  });

  it('serves stale cache on error', () => {
    expect(pestTreatments).toContain('stale: true');
    expect(pestTreatments).toContain('cached');
  });
});

describe('server wiring', () => {
  it('imports the pest treatments route', () => {
    expect(serverEntry).toContain('import { registerPestTreatmentsRoute } from "./src/server/pestTreatments";');
  });

  it('registers the route', () => {
    expect(serverEntry).toContain('registerPestTreatmentsRoute(app);');
  });
});

describe('stale-over-empty discipline (consolidation hardening)', () => {
  it('a transient empty result never poisons the 14-day cache', () => {
    expect(pestTreatments).toContain('if (treatments.length > 0) {');
    expect(pestTreatments).toContain('cache.set(cacheKey, { treatments, fetchedAt: Date.now() })');
  });

  it('degrades without console noise', () => {
    expect(pestTreatments).not.toContain('console.error');
  });
});
