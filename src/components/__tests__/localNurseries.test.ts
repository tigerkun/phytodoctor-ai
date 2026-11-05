import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The Market's Buy-locally section (SERP Feature 9's honest remainder —
 * no geolocation plumbing, no silent location prompt). Source-level; each
 * scan first proves it found the structures it means to police.
 */

const market = stripJsComments(readSource('src/pages/Market.tsx'));
const server = stripJsComments(readSource('src/server/localNurseries.ts'));

describe('Buy locally section (Market)', () => {
  it('the scan found the section it means to check', () => {
    expect(market).toContain('Buy locally');
    expect(market).toContain('/api/market/nurseries?q=');
  });

  it('prefills from the city the app already holds — never a location prompt', () => {
    expect(market).toContain("localStorage.getItem('botanical_city')");
    expect(market).not.toContain('geolocation');
  });

  it('is query-driven: a form submit, not a mount fetch', () => {
    expect(market).toContain('const find = () => {');
    expect(market).toContain('role="search"');
    expect(market).toContain('aria-label="Search area for plant nurseries"');
  });

  it('directions is a navigation link built from returned data', () => {
    expect(market).toContain('function directionsUrl(name: string, address: string | null)');
    expect(market).toContain('google.com/maps/search/?api=1&query=');
    expect(market).toContain("Get directions");
  });

  it('names its source honestly', () => {
    expect(market).toContain('Real nurseries · from Google results');
  });
});

describe('localNurseries server module', () => {
  it('the scan found the module it means to check', () => {
    expect(server).toContain("'/api/market/nurseries'");
  });

  it('queries require a text q — no lat/lng plumbing', () => {
    expect(server).toContain("req.query.q ?? ''");
    expect(server).not.toContain('lat');
    expect(server).not.toContain('location');
  });

  it('the cache key is the normalized query, stale-over-empty', () => {
    // (The rationale comment is stripped; the code is the evidence.)
    expect(server).toContain('normalizeQuery(query)');
    expect(server).toContain('if (nurseries.length > 0) {');
    expect(server).toContain('No nurseries found for that search');
  });

  it('runs on the shared metered client with the ₹ region', () => {
    expect(server).toContain("serpApiSearch('google'");
    expect(server).toContain("gl: 'in'");
    expect(server).toContain("hl: 'en'");
  });
});
