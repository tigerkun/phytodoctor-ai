import { describe, it, expect } from 'vitest';
import { classifyStaticRequest } from '../spaFallback';

// The bug this pins: `app.get('*')` answered every unmatched GET with
// index.html and a 200. Verified live against production before the fix --
// /robots.txt, /sitemap.xml, /assets/does-not-exist.js and /api/nonexistent
// all returned the HTML shell with Content-Type: text/html.
describe('classifyStaticRequest', () => {
  it('serves the shell for real client-side routes', () => {
    for (const p of ['/', '/lab', '/help', '/privacy', '/terms', '/auth']) {
      expect(classifyStaticRequest(p), p).toBe('spa');
    }
  });

  it('serves the shell for deep links, including dynamic plant ids', () => {
    // Plant ids are crypto.randomUUID(), so they never contain a dot. If a
    // future route uses slugs like /plant/monstera.deliciosa this rule would
    // start 404ing it, and the next test is what would catch that.
    expect(classifyStaticRequest('/plant/9f1c2e4a-3b7d-4a11-9c8e-2f0b6d5a1e33')).toBe('spa');
    expect(classifyStaticRequest('/clinic/case-study')).toBe('spa');
  });

  it('does not 404 a route that merely carries a query string', () => {
    expect(classifyStaticRequest('/lab?tab=dex')).toBe('spa');
    expect(classifyStaticRequest('/help#faq')).toBe('spa');
  });

  it('404s a miss for an actual file', () => {
    // A stale asset name must fail as a 404. Returning 200 of HTML is worse:
    // caches will store it, and the browser reports "Unexpected token '<'".
    for (const p of [
      '/assets/does-not-exist.js',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/icon.svg',
      '/sw.js',
    ]) {
      expect(classifyStaticRequest(p), p).toBe('not-found');
    }
  });

  it('answers an unknown /api path in JSON rather than HTML', () => {
    expect(classifyStaticRequest('/api/nonexistent')).toBe('api-not-found');
    expect(classifyStaticRequest('/api/identify/extra/segments')).toBe('api-not-found');
    expect(classifyStaticRequest('/api')).toBe('api-not-found');
  });

  it('does not let the API rule swallow a route that merely starts with "api"', () => {
    expect(classifyStaticRequest('/apidocs')).toBe('spa');
  });

  it('only serves the shell for GET and HEAD', () => {
    // Answering a POST with 200 HTML is how a real backend break hides.
    expect(classifyStaticRequest('/lab', 'POST')).toBe('not-found');
    expect(classifyStaticRequest('/lab', 'HEAD')).toBe('spa');
    expect(classifyStaticRequest('/lab', 'get')).toBe('spa');
  });

  it('classifies an API miss as API even for a non-GET verb', () => {
    expect(classifyStaticRequest('/api/nope', 'DELETE')).toBe('api-not-found');
  });
});
