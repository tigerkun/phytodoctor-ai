import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The Market's honesty upgrade: real web listings next to the curated
 * crates, and the invented numbers GONE from the crates. Source-level; each
 * scan first proves it found the structures it means to police.
 */

const market = stripJsComments(readSource('src/pages/Market.tsx'));
const server = stripJsComments(readSource('src/server/marketLive.ts'));
const serverEntry = stripJsComments(readSource('server.ts'));

describe('the invented ratings are gone from the crates', () => {
  it('the scan found the display sites it means to police', () => {
    expect(market).toContain('Curated crate');
  });

  it('no crate renders stars or invented review counts', () => {
    expect(market).not.toContain('Keepers rate it');
    expect(market).not.toContain('keeper reviews');
    expect(market).not.toContain('★ across');
    // The filter label no longer calls the internal curation score a rating.
    expect(market).toContain('>Curated</option>');
    expect(market).not.toContain('>Rating</option>');
  });

  it('the rating field survives only as the sort heuristic and live data', () => {
    // Live-section ratings are real (engine-supplied); the live section is
    // the only place a star renders. The tag spans lines, so count usages
    // and check position rather than matching one line.
    const starUsages = market.split('<Star').length - 1;
    expect(starUsages).toBe(1);
    expect(market.indexOf('<Star')).toBeGreaterThan(market.indexOf('Garden store · live from the web'));
  });
});

describe('live store section', () => {
  it('the scan found the section it means to check', () => {
    expect(market).toContain('Garden store · live from the web');
    expect(market).toContain('/api/market/live?category=');
  });

  it('renders the engine rating only when it exists', () => {
    expect(market).toContain('{item.rating !== null && (');
    expect(market).toContain('{item.reviews !== null &&');
  });

  it('names the fetch date and the shared weekly budget', () => {
    expect(market).toContain('Fetched {new Date(data.fetchedAt).toLocaleString()}');
    expect(market).toContain('one shared weekly fetch keeps the search budget alive');
  });

  it('degrades honestly instead of pretending', () => {
    expect(market).toContain('Live listings are unavailable right now.');
    expect(market).toContain('the curated crates below are always open');
  });

  it('shows price history without inventing a trend', () => {
    expect(market).toContain('(was ₹{item.previousPrice})');
    expect(market).toContain('item.previousPrice !== item.priceValue');
  });
});

describe('trending strip', () => {
  it('renders nothing on a quiet week — no filler', () => {
    expect(market).toContain('In plant writing this week');
    expect(market).toContain('if (!items.length) return null;');
  });

  it('says what it is: real headlines, not a popularity rank', () => {
    expect(market).toContain('real headlines, not a popularity rank');
  });
});

describe('server wiring', () => {
  it('the scan found the module it means to check', () => {
    expect(server).toContain('registerMarketLiveRoute');
  });

  it('registers the live + trending routes (global limiter covers /api)', () => {
    expect(serverEntry).toContain('import { registerMarketLiveRoute } from "./src/server/marketLive";');
    // Global /api limiter at server.ts:123 covers all routes — no per-route limiter
    expect(serverEntry).toContain('registerMarketLiveRoute(app);');
  });

  it('the shared cache is the quota story: one call per category per week', () => {
    // (Comments are stripped; the code is the evidence.) Four categories ×
    // one weekly shopping call + one weekly trending call is ~21 of the
    // 250/month plan — the allowlist is what keeps it bounded.
    expect(server).toContain('google_shopping');
    expect(server).toContain('CACHE_TTL_MS = 7 * 86_400_000');
    expect(server.match(/LIVE_CATEGORIES: Record<string, string> = \{/)).toBeTruthy();
  });
});
