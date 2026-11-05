import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * Seasonal care alerts (SERP Feature 11) — source-level tests following
 * the established pattern. Each scan first proves it found the structures
 * it means to police.
 */

const seasonalAlerts = stripJsComments(readSource('src/server/seasonalAlerts.ts'));
const serverEntry = stripJsComments(readSource('server.ts'));

describe('seasonal alerts server module', () => {
  it('the scan found the module it means to check', () => {
    expect(seasonalAlerts).toContain('registerSeasonalAlertsRoute');
  });

  it('exports the route registration function', () => {
    expect(seasonalAlerts).toContain('export function registerSeasonalAlertsRoute');
  });

  it('uses serpApiSearch for fetching', () => {
    expect(seasonalAlerts).toContain('serpApiSearch');
  });

  it('checks serpApiStatus before fetching', () => {
    expect(seasonalAlerts).toContain('serpApiStatus');
  });

  it('has cache with TTL', () => {
    expect(seasonalAlerts).toContain('CACHE_TTL_MS');
    expect(seasonalAlerts).toContain('cache.set');
    expect(seasonalAlerts).toContain('cache.get');
  });

  it('extracts tips from organic results', () => {
    expect(seasonalAlerts).toContain('extractTips');
    expect(seasonalAlerts).toContain('organic_results');
  });

  it('requires season and climate parameters', () => {
    expect(seasonalAlerts).toContain('season');
    expect(seasonalAlerts).toContain('climate');
    expect(seasonalAlerts).toContain('400');
  });

  it('has cache reset function for tests', () => {
    expect(seasonalAlerts).toContain('_resetSeasonalAlertsCacheForTests');
  });

  it('serves stale cache on error', () => {
    expect(seasonalAlerts).toContain('stale: true');
    expect(seasonalAlerts).toContain('cached');
  });

  it('extracts priority levels', () => {
    expect(seasonalAlerts).toContain('priority');
    expect(seasonalAlerts).toContain('high');
    expect(seasonalAlerts).toContain('medium');
    expect(seasonalAlerts).toContain('low');
  });

  it('extracts plant types', () => {
    expect(seasonalAlerts).toContain('appliesTo');
    expect(seasonalAlerts).toContain('plantTypes');
  });
});

describe('server wiring', () => {
  it('imports the seasonal alerts route', () => {
    expect(serverEntry).toContain('import { registerSeasonalAlertsRoute } from "./src/server/seasonalAlerts";');
  });

  it('registers the route', () => {
    expect(serverEntry).toContain('registerSeasonalAlertsRoute(app);');
  });
});
